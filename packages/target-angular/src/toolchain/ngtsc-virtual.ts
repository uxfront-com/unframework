// Real ngtsc AOT for virtual modules. Analog compiles only the files of its tsconfig program on
// disk, and an Angular module from the unframework plugin exists only through `load`, so this
// plugin compiles it with `NgtscProgram` over an in-memory host, before Analog sees it. Analog
// then finds no decorators left and passes the module through (the Angular+Qwik ADR). A child
// that a module imports is a virtual module too, so it is resolved and loaded first (ADR-0053).
// The compile itself runs in a worker (ngtsc-worker): Vitest serves every project's transforms
// from one main thread, and a compile there would stall all of them while it runs.
import { dirname, extname, resolve } from "node:path";
import { Worker } from "node:worker_threads";

import type { Plugin } from "vite";

import type { AngularCompiler } from "./tools.ts";

/**
 * The Angular id scheme of the unframework plugin, not on disk: `<abs>/X.uf.tsx.ts` for a file's
 * main component, and `<abs>/X.uf.tsx.<output file>` for any other (`Card.uf.tsx.card-icon.ts`,
 * ADR-0053).
 */
const VIRTUAL_ID = /\.uf\.tsx(?:\.[^/?]+)?\.ts$/;
/**
 * A relative import or re-export in generated code, of a child's output (`./field`, ADR-0053)
 * or of a file on disk: `import … from "./x"`, `export … from "./x"` or `import "./x"`. Its
 * specifier is the first group.
 */
const RELATIVE_IMPORT =
  /^\s*(?:(?:import|export)\b[^"';]*?\bfrom\s*|import\s*)["'](\.\.?\/[^"']+)["']/gm;
/**
 * A component's scoped sheet in generated code, `styleUrl: "./Card.uf.tsx.css"` (ADR-0063): its
 * specifier is the first group.
 */
const STYLE_URL = /\bstyleUrl:\s*["'](\.\/[^"']+\.uf\.tsx\.css)["']/g;
/** An import of another component in generated code: `./Child.uf.tsx`. */
export const COMPONENT_IMPORT: RegExp = /^\.\.?\/.*\.uf\.tsx$/;

/** What the unframework plugin exposes for reading the code it compiled. */
export interface UnframeworkApi {
  getCompiled(id: string): string | undefined;
  getSheet(file: string): string | undefined;
}

/** One compile, as the worker receives it. */
export interface CompileRequest {
  /** The plugin it comes from: each plugin's compiles reuse its own previous program. */
  plugin: number;
  id: string;
  /**
   * The module's source and the generated source of each virtual module it imports, directly or
   * not, by id, and the scoped sheet each of them names as its `styleUrl`, by its path: the
   * worker cannot ask the unframework plugin.
   */
  sources: [id: string, source: string][];
  /** The virtual module each relative import among them resolved to, by `childKey`. */
  children: [key: string, id: string][];
}

/** What the worker receives: a compile, or a plugin whose program it can drop. */
export type WorkerRequest = (CompileRequest & { request: number }) | { release: number };

/** The outcome of one compile: JavaScript and its source map, or what stopped it. */
export interface Compiled {
  code?: string;
  map?: string;
  /** The errors as ngc prints them, and their codes: none when it compiled. */
  errors: string;
  codes: string[];
  warnings: string;
  /** The module's export names, for a module that has to stand in for a rejected one. */
  exports: string[];
}

/** What the worker replies to a compile: its outcome, or what it threw. */
export type WorkerReply = { request: number } & ({ compiled: Compiled } | { failure: unknown });

/**
 * Compiles `<abs>/X.uf.tsx.ts` ids with Angular's AOT compiler under the strict options L3
 * checks with, failing the module on any error (template type errors included) and passing
 * warnings to Vite. Compiles run one at a time in a worker, each reusing the previous program, so
 * libraries are analysed once.
 */
export function ngtscVirtual(compiler: AngularCompiler): Plugin {
  const pluginId = nextPlugin++;
  let api: UnframeworkApi | undefined;
  /** The virtual module each relative import of a virtual module resolved to, by importer. */
  const children = new Map<string, string>();
  // Compiles run in order, and each collects the sources it reads only once the one before it
  // is done, when its host would have read them on this thread.
  let queue: Promise<unknown> = Promise.resolve();

  function compile(id: string, code: string): Promise<Compiled> {
    const sources = new Map([[id, code]]);
    const sheets = new Map<string, string>();
    const resolved = new Map<string, string>();
    // A Map iterates over the entries added while it iterates: each child's imports in turn.
    for (const [file, text] of sources) {
      // The sheet is in no file on disk, and ngtsc reads a `styleUrl` through its host.
      for (const [, specifier = ""] of text.matchAll(STYLE_URL)) {
        const path = resolve(dirname(file), specifier);
        const sheet = api!.getSheet(path.slice(0, -".css".length));
        if (sheet !== undefined) sheets.set(path, sheet);
      }
      for (const [, specifier = ""] of text.matchAll(RELATIVE_IMPORT)) {
        const key = childKey(file, specifier);
        const child = COMPONENT_IMPORT.test(specifier)
          ? `${resolve(dirname(file), specifier)}.ts`
          : children.get(key);
        if (!child) continue;
        if (!COMPONENT_IMPORT.test(specifier)) resolved.set(key, child);
        const source = sources.has(child) ? undefined : api!.getCompiled(child);
        if (source !== undefined) sources.set(child, source);
      }
    }
    return compileWorker(compiler).compile({
      plugin: pluginId,
      id,
      sources: [...sources, ...sheets],
      children: [...resolved],
    });
  }

  const result: Plugin = {
    name: "unframework:angular-ngtsc",
    enforce: "pre",
    configResolved(config) {
      const plugin = config.plugins.find((candidate) => candidate.name === "unframework");
      const candidate = (plugin as { api?: Partial<UnframeworkApi> } | undefined)?.api;
      if (
        typeof candidate?.getCompiled !== "function" ||
        typeof candidate.getSheet !== "function"
      ) {
        throw new Error(
          "The Angular toolchain compiles the unframework plugin's output, but this Vite config " +
            'has no plugin named "unframework" exposing api.getCompiled(id) and api.getSheet(file). Add ' +
            "@unframework/unplugin/vite before the Angular toolchain's plugins.",
        );
      }
      api = candidate as UnframeworkApi;
    },
    transform: {
      filter: { id: /\.uf\.tsx(?:\.[^/?]+)?\.ts(?:\?|$)/ },
      async handler(code, rawId) {
        const id = rawId.split("?")[0]!;
        // ngtsc reads a child's source from the unframework plugin, which has it only once Vite
        // has loaded the child (ADR-0027's negative): resolve each relative import with Vite
        // and load the virtual modules it names before this module compiles (ADR-0053). A child
        // whose source the plugin holds is loaded, or being loaded, already: that also ends a
        // cycle of imports.
        const client =
          this.environment.mode === "dev" && this.environment.config.consumer === "client";
        for (const [, fileName = ""] of code.matchAll(RELATIVE_IMPORT)) {
          if (COMPONENT_IMPORT.test(fileName)) continue;
          const resolved = await this.resolve(fileName, id);
          const child = resolved?.id.split("?")[0];
          if (!resolved || !child || !VIRTUAL_ID.test(child)) continue;
          children.set(childKey(id, fileName), child);
          if (api!.getCompiled(child) !== undefined) continue;
          try {
            await this.load({ id: resolved.id });
          } catch (error) {
            // A child that cannot load fails its parent with the child's reason (the golden
            // guard's, say), which a page would otherwise get only as a failed fetch.
            const reason = error instanceof Error ? error.message : String(error);
            const message = `${id} imports ${fileName}, which failed to load:\n${reason}`;
            if (!client) this.error(message);
            this.environment.logger.error(message);
            return { code: failingModule(message, exportedNames(code)), map: null };
          }
        }
        const run = queue.then(() => compile(id, code));
        // The queue only orders compiles; each caller still gets its own outcome or error.
        queue = run.then(
          () => undefined,
          () => undefined,
        );
        const compiled = await run;
        if (compiled.warnings) this.warn(compiled.warnings);
        if (compiled.codes.length) {
          const message = `ngtsc rejected ${id} (${compiled.codes.join(", ")}):\n${compiled.errors}`;
          // A page gets a module that failed to transform only as "Failed to fetch dynamically
          // imported module", without the reason. Served to a browser, the module throws the
          // reason instead, so it reaches the test report; the server log keeps it too.
          if (client) {
            this.environment.logger.error(message);
            return { code: failingModule(message, compiled.exports), map: null };
          }
          this.error(message);
        }
        if (compiled.code === undefined) this.error(`ngtsc emitted no JavaScript for ${id}`);
        return { code: compiled.code, map: compiled.map ?? null };
      },
    },
  };
  // The worker keeps each plugin's previous program: a plugin that is gone needs it no more.
  released.register(result, () => workers.get(compiler)?.release(pluginId));
  return result;
}

/**
 * The URL of the compile worker beside the module at `moduleUrl`, with the module's own
 * extension: the source worker from `src`, and the built one from `dist`.
 */
export function workerUrl(moduleUrl: string): URL {
  return new URL(`./ngtsc-worker${extname(new URL(moduleUrl).pathname)}`, moduleUrl);
}

/** A worker thread that compiles for every plugin on one compiler, in the order asked. */
interface CompileWorker {
  compile(request: CompileRequest): Promise<Compiled>;
  release(plugin: number): void;
}

let nextPlugin = 0;
const workers = new WeakMap<AngularCompiler, CompileWorker>();
const released = new FinalizationRegistry<() => void>((release) => release());

/**
 * The worker of `compiler`, started on its first compile. One per compiler and so per process:
 * it loads the compiler and parses the library declarations once, as one main thread did for
 * every plugin. It holds the process open only while a compile waits on it.
 */
function compileWorker(compiler: AngularCompiler): CompileWorker {
  const existing = workers.get(compiler);
  if (existing) return existing;
  // `angularScope` is the toolchain directory's `node_modules/@angular` (tools.ts).
  const toolchainDir = dirname(dirname(compiler.angularScope));
  const thread = new Worker(workerUrl(import.meta.url), {
    workerData: { toolchainDir },
  });
  thread.unref();
  const pending = new Map<
    number,
    { resolve(compiled: Compiled): void; reject(e: unknown): void }
  >();
  let nextRequest = 0;
  thread.on("message", (reply: WorkerReply) => {
    const waiting = pending.get(reply.request)!;
    pending.delete(reply.request);
    if (!pending.size) thread.unref();
    if ("failure" in reply) waiting.reject(reply.failure);
    else waiting.resolve(reply.compiled);
  });
  // A worker that died fails what it was compiling, and the next compile starts another.
  thread.on("error", (error) => {
    workers.delete(compiler);
    for (const waiting of pending.values()) waiting.reject(error);
    pending.clear();
  });
  const worker: CompileWorker = {
    compile(request) {
      const number = nextRequest++;
      if (!pending.size) thread.ref();
      return new Promise((fulfil, reject) => {
        pending.set(number, { resolve: fulfil, reject });
        thread.postMessage({ ...request, request: number } satisfies WorkerRequest);
      });
    },
    release(plugin) {
      thread.postMessage({ release: plugin } satisfies WorkerRequest);
    },
  };
  workers.set(compiler, worker);
  return worker;
}

/** The values a module's code exports by name, for a module that stands in for it. */
function exportedNames(code: string): string[] {
  return [...code.matchAll(/^export\s+(?:default\s+)?(?:class|const|function)\s+(\w+)/gm)]
    .filter(([whole]) => !/^export\s+default\b/.test(whole))
    .map(([, name]) => name!);
}

/** The key of an import in `children`: the importing file and the specifier. */
export function childKey(importer: string, specifier: string): string {
  return `${importer}\0${specifier}`;
}

/**
 * A module that throws `message` when it runs and still provides every export of the module it
 * stands in for, so its importers link and the message is what they see.
 */
function failingModule(message: string, exports: readonly string[]): string {
  const lines = [`throw new Error(${JSON.stringify(message)});`, "export default undefined;"];
  const named = exports.filter((name) => name !== "default");
  if (named.length) {
    lines.push(
      "const failed = undefined;",
      `export { ${named.map((name) => `failed as ${JSON.stringify(name)}`).join(", ")} };`,
    );
  }
  return `${lines.join("\n")}\n`;
}
