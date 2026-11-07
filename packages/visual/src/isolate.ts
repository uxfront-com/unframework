// One bad case fails the chunks that import it and not the whole Storybook build, as under Vitest,
// where a module that fails answers only the import that asked for it. Vite's build aborts on the
// first error a hook raises, so the plugins' hooks are wrapped, not named lines of the unplugin:
// whatever a case makes a plugin raise becomes a module that throws it (ADR-0021's guard, for the
// error paths). A failure Rolldown itself raises, past every plugin, such as an import of an export
// a failed module no longer has, still aborts: the build then runs again with the module it names
// failed.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";

import type { BuildFailure } from "@unframework/testing/node";
import type { CompileEvent } from "@unframework/unplugin/vite";
import type { Plugin, PluginOption } from "vite";

/** Names the file that carries an aborted build's failures to the build after it. */
export const ABORTS_ENV = "UF_STORYBOOK_ABORTS";

/** A failed `resolveId` has no module to fail, so it answers with an id of its own. */
const FAILED_ID = "\0uf-visual:failed:";

/**
 * Stands in for a failed module until the last transform: empty text is valid to every plugin we
 * can't wrap, Vite's CSS pipeline included, which a throwing module's JavaScript would fail.
 */
const PLACEHOLDER = { code: "", map: { mappings: "" } };

type Handler = (this: unknown, ...args: unknown[]) => unknown;

/** The error a hook raises, or one of those an aborted build lists. */
interface RaisedError {
  message: string;
  /** The module, where the error names one. */
  id?: string;
  /** The module whose export a link error couldn't find. */
  exporter?: string;
}

/** What {@link isolateFailures} returns. */
export interface Isolation {
  /** Serves the failed modules and records an abort. It goes in the build's plugins. */
  plugin: Plugin;
  /** The plugins of an option, each with its hooks wrapped. */
  wrap(option: PluginOption): Promise<Plugin[]>;
  /** The unplugin's `onCompile`, which also records what the guard failed. */
  guarded(
    check: (event: CompileEvent) => string | void | Promise<string | void>,
  ): (event: CompileEvent) => Promise<string | void>;
  /** Every module the build turned into one that throws. */
  failures: () => BuildFailure[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readAborts(file: string | undefined): BuildFailure[] {
  return file && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as BuildFailure[]) : [];
}

/** The part of a Vite option that holds plugins, flat. */
async function flatten(option: PluginOption): Promise<Plugin[]> {
  const value = await option;
  if (Array.isArray(value)) return (await Promise.all(value.map(flatten))).flat();
  return value ? [value as Plugin] : [];
}

/**
 * Replaces a hook's function on the plugin's own objects, never a copy: plugins set a hook's
 * `filter` later, through their own reference to the plugin (plugin-vue, vite-plugin-svelte).
 */
function wrapHook(
  plugin: Plugin,
  name: "resolveId" | "load" | "transform",
  wrap: (handler: Handler) => Handler,
) {
  const hook = plugin[name] as unknown as Handler | { handler: Handler } | undefined;
  if (!hook) return;
  if (typeof hook === "function") plugin[name] = wrap(hook) as never;
  else hook.handler = wrap(hook.handler);
}

/**
 * The isolation of one build. `root` bounds what an abort may fail: a module outside it isn't a
 * case's, so the build stays aborted with Rolldown's error (P2). A dev server is left alone: it
 * already answers each module's request on its own, and writes no manifest.
 */
export function isolateFailures(
  root: string,
  abortsFile: string | undefined = process.env[ABORTS_ENV],
): Isolation {
  const causes = new Map(readAborts(abortsFile).map(({ module, cause }) => [module, cause]));
  // What this build replaces. A guard's verdict is only recorded: the unplugin's `post` hook
  // replaces that module, after the framework's plugin has compiled it.
  const failed = new Set(causes.keys());
  let building = false;

  const note = (id: string, message: string) => {
    const text = stripVTControlCharacters(message);
    const earlier = causes.get(id);
    causes.set(
      id,
      earlier === undefined || text.includes(earlier) ? text : `${text}\n\n${earlier}`,
    );
  };

  /** Wraps a hook whose module is the argument `position` holds. */
  const onModule =
    (position: 0 | 1) =>
    (handler: Handler): Handler =>
      async function (this: unknown, ...args: unknown[]) {
        if (!building) return handler.apply(this, args);
        const id = args[position] as string;
        if (failed.has(id)) return null;
        try {
          return await handler.apply(this, args);
        } catch (error) {
          note(id, messageOf(error));
          failed.add(id);
          return PLACEHOLDER;
        }
      };

  const onResolve = (handler: Handler): Handler =>
    async function (this: unknown, ...args: unknown[]) {
      if (!building) return handler.apply(this, args);
      try {
        return await handler.apply(this, args);
      } catch (error) {
        const [source, importer] = args as [string, string | undefined];
        const id = `${FAILED_ID}${source} from ${importer}`;
        note(id, messageOf(error));
        failed.add(id);
        return id;
      }
    };

  /**
   * Leaves the modules an abort names, with why, for the build after this one, and every failure
   * so far: an importer that's failed no longer loads them, and the manifest still names them. A
   * link error names only the missing export, so the exporter's own cause goes after it. One error
   * that isn't a case's keeps the build aborted, or the rebuild could stop reaching it.
   */
  const recordAbort = (error: unknown) => {
    if (!abortsFile || !error) return;
    const { errors = [error as RaisedError] } = error as { errors?: RaisedError[] };
    const named = new Map<string, string>();
    for (const { id, message, exporter } of errors) {
      if (!id?.startsWith(`${root}/`)) return;
      const why = exporter === undefined ? undefined : causes.get(exporter);
      const text = stripVTControlCharacters(why === undefined ? message : `${message}\n\n${why}`);
      named.set(id, named.has(id) ? `${named.get(id)}\n\n${text}` : text);
    }
    if (named.size === 0) return;
    // One entry per module, so an abort that names nothing new doesn't grow the file.
    const next = new Map([...named, ...causes]);
    const list = [...next].map(([module, cause]) => ({ module, cause }));
    writeFileSync(abortsFile, `${JSON.stringify(list, null, 2)}\n`);
  };

  return {
    plugin: {
      name: "uf-visual:isolate",
      apply: "build",
      configResolved() {
        building = true;
      },
      load: {
        order: "pre",
        handler: (id) => (failed.has(id) ? PLACEHOLDER : null),
      },
      transform: {
        order: "post",
        handler(_code, id) {
          if (!failed.has(id)) return null;
          return {
            code: `throw new Error(${JSON.stringify(causes.get(id))});\nexport default undefined;\n`,
            map: { mappings: "" },
            // Importing it must throw, even from a package that declares no side effects.
            moduleSideEffects: "no-treeshake",
          };
        },
      },
      buildEnd: recordAbort,
      renderError: recordAbort,
    },
    async wrap(option) {
      const plugins = await flatten(option);
      for (const plugin of plugins) {
        wrapHook(plugin, "resolveId", onResolve);
        wrapHook(plugin, "load", onModule(0));
        wrapHook(plugin, "transform", onModule(1));
      }
      return plugins;
    },
    guarded: (check) => async (event) => {
      let verdict: string | void;
      try {
        verdict = await check(event);
      } catch (error) {
        note(event.id, messageOf(error));
        throw error;
      }
      if (verdict !== undefined)
        note(event.id, verdict || "The guard failed it without a message.");
      return verdict;
    },
    failures: () => [...causes].map(([module, cause]) => ({ module, cause })),
  };
}

/**
 * Runs a build until it stops aborting on a module it can fail. Each abort names at least one more
 * module, or the build's own exit code stands, so this ends.
 */
export async function buildIsolated(
  file: string,
  build: (env: Record<string, string>) => Promise<number>,
): Promise<number> {
  rmSync(file, { force: true });
  let known = 0;
  for (;;) {
    const code = await build({ [ABORTS_ENV]: file });
    if (code === 0) return code;
    const modules = readAborts(file).map(({ module }) => module);
    if (modules.length === known) return code;
    console.error(
      `[uf] The build aborted. Building again with these failed: ${modules.join(", ")}`,
    );
    known = modules.length;
  }
}
