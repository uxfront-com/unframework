import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, isAbsolute, posix, relative, sep } from "node:path";

import type { OutputFile, Target } from "@unframework/codegen";
import { compile, createFileResolver, resolveTarget } from "@unframework/compiler";
import type { CompileResult, CompilerPlugin, TargetName, UfModule } from "@unframework/compiler";
import { formatDiagnostic, formatDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { createUnplugin } from "unplugin";
import type { UnpluginFactory, UnpluginInstance, UnpluginOptions } from "unplugin";
import type { Environment } from "vite";

import { assembleModule } from "./assemble.ts";
import {
  COMPONENT_ID_FILTER,
  componentId,
  idSuffix,
  moduleId,
  moduleIdCandidates,
  moduleIdFilter,
  parseComponentId,
  parseModuleId,
  SCAN_ID_PREFIX,
  SOURCE_EXTENSION,
  specifierFilter,
} from "./ids.ts";

/** What {@link UnframeworkOptions.onCompile} receives for every module it loads. */
export interface CompileEvent {
  /** The module id, such as `/abs/Hello.uf.tsx.vue`. */
  id: string;
  /** The absolute path of the authored `.uf.tsx` file. */
  file: string;
  /** The target's name. */
  target: string;
  /** Every file the target emitted for the module: what the golden files hold. */
  files: OutputFile[];
  /** Every diagnostic of the compile, sorted. */
  diagnostics: Diagnostic[];
  /**
   * The compile's IR, absent when the file did not parse: what the module's components declare,
   * such as the events a test listens to (the harness's `ufComponentEvents`).
   */
  ir?: UfModule;
}

/** Options of the unframework plugin. */
export interface UnframeworkOptions {
  /** The framework to compile to: a built-in target's name, or a third-party target. */
  target: TargetName | Target;
  /**
   * What module ids append to the `.uf.tsx` path: the extension the framework's own Vite plugin
   * claims, such as `".vue"`, or `""` to keep the `.uf.tsx` id. Defaults to the built-in
   * target's suffix (`ID_SUFFIXES`); a third-party target must set it.
   */
  extension?: string;
  /**
   * Called each time a module loads, with the compile it loads from, errors included. Returning
   * a string fails that module with the string as its error (the harness's golden guard): the
   * module still goes through the framework's plugin, and its final code becomes
   * `throw new Error(message)`, so the message reaches the test report. A compile that has
   * errors fails anyway, with the message after its diagnostics.
   */
  onCompile?(event: CompileEvent): string | void | Promise<string | void>;
  /** Compiler plugins, passed to `compile()` (the harness's canaries). */
  plugins?: readonly CompilerPlugin[];
  /** Formats the output with oxfmt. Defaults to `true`, so modules equal the golden files. */
  format?: boolean;
}

/** What the pre plugin exposes as `api`, for other plugins that need the compiled sources. */
export interface UnframeworkApi {
  /**
   * The target source of the last load of a module id that finished, in any environment, or
   * `undefined` when the id has not loaded or that load failed. Angular's `ngtscVirtual` reads
   * child components with it.
   */
  getCompiled(id: string): string | undefined;
}

/** The name of the pre plugin, by which other plugins find its {@link UnframeworkApi}. */
export const PLUGIN_NAME = "unframework";

// Vite's own queries for a file as an asset or a worker: they mean the authored file, so
// they never become module ids, and `load` leaves them to Vite (Vite's SPECIAL_QUERY_RE).
const VITE_FILE_QUERY = /[?&](?:worker|sharedworker|raw|url)\b/;

interface CachedCompile {
  source: string;
  filename: string;
  /**
   * The files the resolver read for the compile, with what it read (`undefined` for one that
   * did not exist): a child's API is an input of its parent's compile (ADR-0053).
   */
  reads: Map<string, string | undefined>;
  result: Promise<CompileResult>;
}

/** A relative specifier: an output's import of another output (`./Field.vue`, ADR-0053). */
const RELATIVE = /^\.\.?\//;

/** The output files a script target joins into one module (`.tsx`, `.ts`). */
const SCRIPT = /^\.tsx?$/;

interface FailedModule {
  message: string;
  exports: string[];
}

/**
 * The hooks are Vite's (`vite:`), not unplugin's portable ones: they rely on Vite's environments,
 * its dependency scan and its framework plugins claiming module ids by extension. M6 ports them
 * to the other bundlers.
 */
const factory: UnpluginFactory<UnframeworkOptions, true> = (options, meta) => {
  if (meta.framework !== "vite") {
    throw new Error(
      `@unframework/unplugin supports Vite only for now; ${meta.framework} support is planned for M6.`,
    );
  }
  const target = resolveTarget(options.target);
  const suffix = idSuffix(options.target, options.extension);
  // The output file a module id loads has the id's extension: `.tsx` when the id is the
  // `.uf.tsx` file itself.
  const extension = extname(`${SOURCE_EXTENSION}${suffix}`);
  // A file's main component loads under its module id, and each other component under a
  // component id (ADR-0053); a script target joins them all under the module id.
  const moduleIds = [moduleIdFilter(suffix), COMPONENT_ID_FILTER];
  // With a suffix, the authored file is never a module id. One that reaches `load` came through
  // an import `resolveId` never saw, and must fail rather than load as plain TSX.
  const loadIds = suffix ? [...moduleIds, moduleIdFilter("")] : moduleIds;
  const joins = SCRIPT.test(extension);
  // A framework plugin requests parts of a module with a query parameter named after its
  // extension (`?vue&type=style…`, `?svelte&type=style…`, `?astro&type=script…`), and serves
  // them from its own compile of the module. Any other query is a module of its own (Astro's
  // `?container`), which loads like the bare id, whatever the process did before.
  const subRequest = new RegExp(`[?&]${extension.slice(1)}(?:[&=]|$)`);

  // Vite's root, with forward slashes; configResolved sets it before any other hook runs.
  let root = process.cwd().split(sep).join("/");
  const cache = new Map<string, CachedCompile>();
  // Replaced when a load finishes, never cleared while one runs: client and ssr load the same
  // id concurrently, and `getCompiled` must not miss a module because another environment is
  // reloading it.
  const compiled = new Map<string, string>();
  // The modules the guard failed, per environment (what Vite's `perEnvironmentState` does,
  // without importing Vite at runtime). One plugin instance serves every environment of a
  // server, and each environment's post transform must read the verdict on its own load, not on
  // one that another environment has just started. Throwing from `load` would reach the browser
  // as an HTTP 500, and Vitest would only report "Failed to fetch dynamically imported module";
  // the post plugin replaces the final code of these modules instead, so the message itself is
  // reported.
  const failures = new WeakMap<Environment, Map<string, FailedModule>>();
  const failuresIn = (environment: Environment) => {
    let failed = failures.get(environment);
    if (!failed) {
      failed = new Map();
      failures.set(environment, failed);
    }
    return failed;
  };

  /** The file name diagnostics use: relative to the root, with forward slashes. */
  const filenameOf = (file: string) => relative(root, file).split(sep).join("/");

  /**
   * A component id taken apart, unless the id is a module id: a suffix of several extensions
   * (`.client.vue`) reads as a component id too, and a module id wins.
   */
  const componentRequest = (id: string) =>
    parseModuleId(id, suffix) ? undefined : parseComponentId(id);

  /** Whether the files a compile's resolver read still hold what it read. */
  const unchanged = async (reads: ReadonlyMap<string, string | undefined>) => {
    for (const [path, text] of reads) {
      if ((await readFile(path, "utf8").catch(() => undefined)) !== text) return false;
    }
    return true;
  };

  /**
   * The compile of a file's current source, shared by every id that loads it. Its children's
   * APIs come from the files they are in, read by the compile's resolver (ADR-0053): the compile
   * is reused while the file and every file the resolver read are unchanged.
   */
  const compileFile = async (file: string, filename: string, source: string) => {
    const cached = cache.get(file);
    if (
      cached &&
      cached.source === source &&
      cached.filename === filename &&
      (await unchanged(cached.reads))
    ) {
      return cached.result;
    }
    const reads = new Map<string, string | undefined>();
    const resolve = createFileResolver({
      root,
      readFile: async (path) => {
        const text = await readFile(path, "utf8").catch(() => undefined);
        reads.set(path, text);
        return text;
      },
    });
    const result = compile(source, {
      filename,
      targets: [target],
      format: options.format !== false,
      plugins: options.plugins,
      resolve,
    });
    cache.set(file, { source, filename, reads, result });
    // compile() never rejects unless the compiler has a bug. The load that awaits `result`
    // reports it; dropping the entry lets the next load try again.
    result.catch(() => {
      if (cache.get(file)?.result === result) cache.delete(file);
    });
    return result;
  };

  /** The guard's verdict on a load: the message that fails the module, if any. */
  const guard = async (event: CompileEvent): Promise<string | undefined> => {
    if (!options.onCompile) return undefined;
    let verdict: string | void;
    try {
      verdict = await options.onCompile(event);
    } catch (error) {
      const reason = error instanceof Error ? (error.stack ?? error.message) : String(error);
      return `onCompile threw while checking ${event.id}: ${reason}`;
    }
    if (typeof verdict !== "string") return undefined;
    return verdict || `onCompile failed ${event.id} without a message.`;
  };

  /** A module id coming back, as the absolute id `load` receives, if its `.uf.tsx` file exists. */
  const resolveModuleId = (path: string, query: string, importer: string | undefined) => {
    const id = moduleIdCandidates(path, root, importer).find((candidate) =>
      existsSync(parseModuleId(candidate, suffix)!.file),
    );
    return id === undefined ? undefined : `${id}${query}`;
  };

  /**
   * Why an authored `.uf.tsx` file reached `load` as itself on a target whose module ids have a
   * suffix: its import did not name the file, so `resolveId` never saw it.
   *
   * M6 (plugin mode and packaging, plan §8.2 and §8.4) decides whether packages may ship
   * `.uf.tsx` sources. They reach the bundler through `exports` entries this cannot see, and,
   * from `node_modules`, through the dependency optimizer, which bundles them as plain TSX before
   * any plugin runs, on every target. Supporting them takes a module here that re-exports the
   * component's module id, and an optimizer plugin that refuses `.uf.tsx` files; until then this
   * is the loud failure.
   */
  const bypassed = (file: string) =>
    `${filenameOf(file)} reached Vite as itself, which would load it as plain TSX rather than as its ${target.name} component: the import that resolved to it does not name the file (a package's \`exports\` entry or a tsconfig path, say), so this plugin never saw it. Import it with a specifier that ends in ${SOURCE_EXTENSION}, such as "./${basename(file)}"; a package that ships ${SOURCE_EXTENSION} sources must export them under subpaths that do.`;

  /** The current compile of an authored file, read from disk. */
  const compiledFile = async (file: string) =>
    compileFile(file, filenameOf(file), await readFile(file, "utf8"));

  /**
   * The id an output's relative import of another output resolves to (ADR-0053), looked up in
   * the importer's compile: a component of its file, or of a file it imports. A file's main
   * component loads under its module id, as does every component on a target that joins a
   * file's outputs; any other under its component id. `undefined` for an import no compile names.
   */
  const childId = async (file: string, specifier: string): Promise<string | undefined> => {
    if (!cache.has(file)) return undefined;
    const result = await cache.get(file)!.result;
    const wanted = posix.join(posix.dirname(file), specifier);
    const files = [
      file,
      ...(result.ir?.imports ?? []).map((entry) => posix.join(posix.dirname(file), entry.file)),
    ];
    for (const candidate of files) {
      const compiled = candidate === file ? result : await compiledFile(candidate);
      const owners = compiled.owners[target.name] ?? {};
      for (const [path, component] of Object.entries(owners)) {
        const output = posix.join(posix.dirname(candidate), path);
        if (output !== wanted && output.replace(/\.[^./]+$/, "") !== wanted) continue;
        if (joins || component === mainComponent(compiled.ir)) return moduleId(candidate, suffix);
        return componentId(candidate, path);
      }
    }
    return undefined;
  };

  /** The files a compile resolved its children from: its watch edges (ADR-0053). */
  const childFiles = async (file: string): Promise<string[]> => {
    const result = await cache.get(file)?.result.catch(() => undefined);
    return (result?.ir?.imports ?? []).map((entry) => posix.join(posix.dirname(file), entry.file));
  };

  const pre: UnpluginOptions = {
    name: PLUGIN_NAME,
    enforce: "pre",
    vite: {
      configResolved(config) {
        root = config.root;
      },
      resolveId: {
        filter: { id: [specifierFilter(suffix), COMPONENT_ID_FILTER, RELATIVE] },
        async handler(source, importer, resolveOptions) {
          const index = source.indexOf("?");
          const path = index === -1 ? source : source.slice(0, index);
          const query = index === -1 ? "" : source.slice(index);
          // A component id coming back: from a framework plugin's sub-request, absolute.
          const component = componentRequest(path);
          if (component) {
            const id = moduleIdCandidates(path, root, importer).find((candidate) =>
              existsSync(componentRequest(candidate)!.file),
            );
            return id === undefined ? null : `${id}${query}`;
          }
          // An output's import of another output (ADR-0053): `./Field.vue` from a module of ours.
          const from = importer && (parseModuleId(importer, suffix) ?? componentRequest(importer));
          if (
            from &&
            isAbsolute(from.file) &&
            RELATIVE.test(path) &&
            !specifierFilter(suffix).test(path)
          ) {
            const child = await childId(from.file, path);
            if (child !== undefined) return `${child}${query}`;
          }
          if (!specifierFilter(suffix).test(source)) return null;
          // One of our module ids coming back: an absolute id from a plugin, a root-relative URL
          // from the browser on a cold server (`/cases/hello/Hello.uf.tsx.vue`), or a path
          // relative to its importer. `load` must receive the absolute id, and queries
          // (sub-requests) stay on it.
          if (suffix && path.endsWith(`${SOURCE_EXTENSION}${suffix}`)) {
            return resolveModuleId(path, query, importer) ?? null;
          }
          if (VITE_FILE_QUERY.test(query)) return null;

          // Decided by the file the specifier resolves to, so `./X.uf` and `./X.uf.js` compile
          // like `./X.uf.tsx`, and a `./X.uf` that is a composable (`X.uf.ts`) is left alone.
          const resolved = await this.resolve(path, importer, { skipSelf: true });
          if (!resolved || resolved.external || !resolved.id.endsWith(SOURCE_EXTENSION)) {
            return null;
          }
          const file = resolved.id;
          // `scan` is set by Vite's dependency scanner and missing from the public type.
          if ("scan" in resolveOptions && resolveOptions.scan === true) {
            return `${SCAN_ID_PREFIX}${file}`;
          }
          // `this.addWatchFile(file)` in `transform` makes Vite's import analysis resolve the
          // file with our module as the importer. Answering with the real file gives the module
          // graph a node for it whose importer is the module: the edge that makes an edit
          // invalidate the module and `vitest --watch` rerun its tests. A module of ours imports
          // no `.uf.tsx` file but these: its own, and its children's (ADR-0053).
          if (
            importer !== undefined &&
            (parseModuleId(importer, suffix) ?? componentRequest(importer))
          ) {
            return file;
          }
          return moduleId(file, suffix, query);
        },
      },
      load: {
        filter: { id: loadIds },
        async handler(id) {
          const component = componentRequest(id);
          const request = component ?? parseModuleId(id, suffix);
          if (!request) {
            const authored = parseModuleId(id, "")!;
            if (VITE_FILE_QUERY.test(authored.query)) return null;
            return this.error(bypassed(authored.file));
          }
          if (!isAbsolute(request.file)) return null;
          if (VITE_FILE_QUERY.test(request.query) || subRequest.test(request.query)) return null;

          const failed = failuresIn(this.environment);
          const source = await readFile(request.file, "utf8");
          const filename = filenameOf(request.file);
          const result = await compileFile(request.file, filename, source);
          const files = result.outputs[target.name] ?? [];
          for (const diagnostic of result.diagnostics) {
            if (diagnostic.severity !== "error") this.warn(formatDiagnostic(diagnostic, source));
          }
          const verdict = await guard({
            id,
            file: request.file,
            target: target.name,
            files,
            diagnostics: result.diagnostics,
            ...(result.ir ? { ir: result.ir } : {}),
          });
          const fail = (message: string) => {
            compiled.delete(id);
            failed.delete(id);
            return this.error(verdict ? `${message}\n\n${verdict}` : message);
          };

          const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
          if (errors.length > 0) return fail(formatDiagnostics(errors, { [filename]: source }));
          const owners = result.owners[target.name] ?? {};
          const main = mainComponent(result.ir);
          // A component id loads its component's file; a main id, the main component's files,
          // or every component's on a target that joins them (ADR-0053).
          const loaded = component
            ? files.filter((file) => file.path === component.output)
            : joins
              ? files
              : files.filter((file) => owners[file.path] === main);
          if (component && !loaded.length) {
            return fail(
              `The ${target.name} target emitted no ${component.output} for ${filename}, which the id ${id} loads.`,
            );
          }
          const exports = (result.ir?.exports ?? []).filter(
            (entry) => joins || component !== undefined || entry.local === main,
          );
          const assembly = assembleModule({
            target: target.name,
            filename,
            extension: component ? extname(component.output) : extension,
            files: loaded,
            exports: component ? [] : exports,
            siblings: files.map((file) => file.path),
          });
          if ("error" in assembly) return fail(assembly.error);
          compiled.set(id, assembly.code);
          if (verdict === undefined) {
            failed.delete(id);
          } else {
            const named = exports.filter((entry) => entry.kind === "named");
            failed.set(id, { message: verdict, exports: named.map((entry) => entry.name) });
          }
          return { code: assembly.code };
        },
      },
      transform: {
        filter: { id: moduleIds },
        async handler(_code, id) {
          // The watch edges (see resolveId): to the file, for every id except a `.tsx` one, whose
          // module is the file itself, and to each child the compile resolved, whose API the
          // output depends on (ADR-0053). They are added here rather than in `load`: Vite keeps
          // the files a load adds only when the module is already in its graph, which a cold
          // request's is not, while a transform always runs on a module the graph holds.
          const component = componentRequest(id);
          const request = component ?? parseModuleId(id, suffix);
          if (!request || !isAbsolute(request.file)) return null;
          if (suffix || component) this.addWatchFile(request.file);
          for (const child of await childFiles(request.file)) this.addWatchFile(child);
          return null;
        },
      },
      api: {
        getCompiled: (id: string) => compiled.get(id),
      } satisfies UnframeworkApi,
    },
  };

  const post: UnpluginOptions = {
    name: `${PLUGIN_NAME}:guard`,
    enforce: "post",
    vite: {
      transform: {
        filter: { id: moduleIds },
        handler(_code, id) {
          const failure = failures.get(this.environment)?.get(id);
          if (!failure) return null;
          return { code: failingModule(failure), map: { mappings: "" } };
        },
      },
    },
  };

  return [pre, post];
};

/**
 * A file's main component (ADR-0053): its default export, or its only exported component;
 * `undefined` for a file with neither, whose module id loads nothing.
 */
function mainComponent(ir: UfModule | undefined): string | undefined {
  const exports = ir?.exports ?? [];
  const main = exports.find((entry) => entry.kind === "default");
  if (main) return main.local;
  const locals = new Set(exports.map((entry) => entry.local));
  return locals.size === 1 ? [...locals][0] : undefined;
}

/**
 * A module that throws the message when it runs, and still provides every export the compiled
 * module had, so its importers link and the message reaches the report.
 */
function failingModule({ message, exports }: FailedModule): string {
  const lines = [`throw new Error(${JSON.stringify(message)});`, "export default undefined;"];
  if (exports.length > 0) {
    const names = exports.map((name) => `failed as ${JSON.stringify(name)}`).join(", ");
    lines.push("const failed = undefined;", `export { ${names} };`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * The unframework plugin for every bundler unplugin supports. Only Vite is supported until M6:
 * any other bundler throws when the plugin is created.
 */
export const unframeworkUnplugin: UnpluginInstance<UnframeworkOptions, true> =
  createUnplugin(factory);
