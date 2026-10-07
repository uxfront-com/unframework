import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, sep } from "node:path";

import type { OutputFile, Target } from "@unframework/codegen";
import { compile, resolveTarget } from "@unframework/compiler";
import type { CompileResult, CompilerPlugin, TargetName, UfModule } from "@unframework/compiler";
import { formatDiagnostic, formatDiagnostics } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { createUnplugin } from "unplugin";
import type { UnpluginFactory, UnpluginInstance, UnpluginOptions } from "unplugin";
import type { Environment } from "vite";

import { assembleModule } from "./assemble.ts";
import {
  idSuffix,
  moduleId,
  moduleIdCandidates,
  moduleIdFilter,
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
  result: Promise<CompileResult>;
}

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
  const moduleIds = moduleIdFilter(suffix);
  // With a suffix, the authored file is never a module id. One that reaches `load` came through
  // an import `resolveId` never saw, and must fail rather than load as plain TSX.
  const loadIds = suffix ? [moduleIds, moduleIdFilter("")] : moduleIds;
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

  /** The compile of a file's current source, shared by every id that loads it. */
  const compileFile = (file: string, filename: string, source: string) => {
    const cached = cache.get(file);
    if (cached && cached.source === source && cached.filename === filename) return cached.result;
    const result = compile(source, {
      filename,
      targets: [target],
      format: options.format !== false,
      plugins: options.plugins,
    });
    cache.set(file, { source, filename, result });
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

  const pre: UnpluginOptions = {
    name: PLUGIN_NAME,
    enforce: "pre",
    vite: {
      configResolved(config) {
        root = config.root;
      },
      resolveId: {
        filter: { id: specifierFilter(suffix) },
        async handler(source, importer, resolveOptions) {
          const index = source.indexOf("?");
          const path = index === -1 ? source : source.slice(0, index);
          const query = index === -1 ? "" : source.slice(index);
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
          // invalidate the module and `vitest --watch` rerun its tests.
          if (importer !== undefined && parseModuleId(importer, suffix)?.file === file) {
            return file;
          }
          return moduleId(file, suffix, query);
        },
      },
      load: {
        filter: { id: loadIds },
        async handler(id) {
          const request = parseModuleId(id, suffix);
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
          const exports = result.ir?.exports ?? [];
          const assembly = assembleModule({
            target: target.name,
            filename,
            extension,
            files,
            exports,
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
        handler(_code, id) {
          // The watch edge (see resolveId), for every id except a `.tsx` one, whose module is the
          // file itself. It is added here rather than in `load`: Vite keeps the files a load adds
          // only when the module is already in its graph, which a cold request's is not, while a
          // transform always runs on a module the graph holds.
          const request = parseModuleId(id, suffix);
          if (suffix && request && isAbsolute(request.file)) this.addWatchFile(request.file);
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
