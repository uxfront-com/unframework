// Which target an app's Vite configuration asks for, and what in it the outputs can't work with
// (plan §8.2, ADR-0075, ADR-0026). Both read the plugins by the names they register, which are the
// framework plugins' own: none of them is a dependency of this package.
import { readFileSync, realpathSync, statSync } from "node:fs";

import type { TargetName } from "@unframework/compiler";
import { createDiagnostic, formatDiagnostic } from "@unframework/diagnostics";

/** What these checks read of a Vite plugin. */
interface NamedPlugin {
  // Vite's type requires it, and Vite doesn't: a plain JavaScript plugin may have none.
  name?: string;
  api?: unknown;
}

/** The name plugin-vue registers. */
const VUE_PLUGIN = "vite:vue";

/** Whether a plugin of this name belongs to each framework a built-in target compiles to. */
const FRAMEWORK_PLUGINS: Readonly<Record<TargetName, (name: string) => boolean>> = {
  react: (name) => name.startsWith("vite:react-"),
  vue: (name) => name === VUE_PLUGIN,
  svelte: (name) => name === "vite-plugin-svelte",
  solid: (name) => name === "solid",
  angular: (name) => name === "@analogjs/vite-plugin-angular",
  qwik: (name) => name === "vite-plugin-qwik",
  astro: (name) => name.startsWith("astro:"),
};

// A configuration is no source: these have no position to point at.
const NO_SPAN = { start: 0, end: 0 };

/**
 * The one target whose framework's plugin is among `plugins`, or the UF7005 or UF7006 message that
 * says why there isn't one. `file` names the configuration in the message.
 */
export function detectTarget(
  plugins: readonly NamedPlugin[],
  file: string,
): { target: TargetName } | { error: string } {
  const names = plugins.flatMap(({ name }) => (typeof name === "string" ? [name] : []));
  const found = Object.entries(FRAMEWORK_PLUGINS).flatMap(([target, belongs]) => {
    const plugin = names.find((name) => belongs(name));
    return plugin ? [{ target: target as TargetName, plugin }] : [];
  });
  if (found.length === 1) return { target: found[0]!.target };
  const diagnostic = found.length
    ? createDiagnostic("UF7006", {
        file,
        span: NO_SPAN,
        message: `The plugin has no \`target\` option, and the Vite configuration holds the plugins of ${found
          .map(({ target, plugin }) => `${target} (${plugin})`)
          .join(" and ")}, so it can't choose a target.`,
        help: "Pass `target` to the Unframework plugin.",
      })
    : createDiagnostic("UF7005", {
        file,
        span: NO_SPAN,
        message:
          "The plugin has no `target` option, and no plugin in the Vite configuration belongs to a framework it knows.",
        help: "Add the framework's Vite plugin to the configuration, or pass `target` to the Unframework plugin.",
      });
  return { error: formatDiagnostic(diagnostic, undefined) };
}

/** What plugin-vue's `api.options` holds of the options UF7010 reads and `fillVueScriptFs` fills. */
interface VueOptions {
  template?: { compilerOptions?: { whitespace?: unknown } };
  script?: { fs?: unknown };
}

/** plugin-vue's `api`, whose `options` is a getter and a setter over the options it compiles with. */
interface VueApi {
  options?: VueOptions;
}

/**
 * The UF7010 message for plugin-vue's whitespace option, when it is `"preserve"`: the printer lays
 * a template out for `"condense"`, and the option can't be set per file (ADR-0026).
 */
export function hostOptionWarning(
  plugins: readonly NamedPlugin[],
  file: string,
): string | undefined {
  const vue = plugins.find(({ name }) => name === VUE_PLUGIN);
  const whitespace = (vue?.api as VueApi | undefined)?.options?.template?.compilerOptions
    ?.whitespace;
  if (whitespace !== "preserve") return undefined;
  const diagnostic = createDiagnostic("UF7010", {
    file,
    span: NO_SPAN,
    message:
      'plugin-vue\'s `template.compilerOptions.whitespace` is "preserve", and outputs assume "condense", so a component can render different whitespace from the other targets.',
    help: 'Remove the option, or set it to "condense".',
  });
  return formatDiagnostic(diagnostic, undefined);
}

/** What Vue's `compileScript` reads imported types through: plugin-vue's `script.fs`. */
interface ScriptFs {
  fileExists(file: string): boolean;
  readFile(file: string): string | undefined;
  realpath(file: string): string;
}

/** The errors that mean a path names no file to read, which TypeScript's `sys` reports as none. */
const NO_FILE: ReadonlySet<unknown> = new Set(["ENOENT", "ENOTDIR", "EISDIR"]);

const isNoFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && NO_FILE.has(error.code);

/**
 * Node's file system, in the shape TypeScript's `sys` gives `compileScript`: a directory is no
 * file, a missing file reads as `undefined` and a path that can't be resolved is its own real path.
 * Any other error, such as a file it may not read, throws.
 */
export const NODE_SCRIPT_FS: ScriptFs = {
  fileExists: (file) => statSync(file, { throwIfNoEntry: false })?.isFile() ?? false,
  readFile(file) {
    try {
      return readFileSync(file, "utf8");
    } catch (error) {
      if (isNoFile(error)) return undefined;
      throw error;
    }
  },
  realpath(file) {
    try {
      return realpathSync(file);
    } catch (error) {
      if (isNoFile(error)) return file;
      throw error;
    }
  },
};

/**
 * Gives plugin-vue Node's file system for imported types, unless the app gave its own (ADR-0082).
 * Vue's `compileScript` reads a props type imported from another module through `script.fs`, or
 * through TypeScript's `sys` without one, and TypeScript 7 doesn't export `sys`. plugin-vue passes
 * no `fs`, so on TypeScript 7 every component whose props type comes from another module fails to
 * compile: the outputs, and the app's own `.vue` files too. The options are replaced through
 * plugin-vue's setter, never changed in place, so the app's own object stays as it wrote it.
 * plugin-vue's `configResolved` rebuilds its options from the current ones, so the fill holds
 * whichever of the two plugins' hooks runs first.
 */
export function fillVueScriptFs(plugins: readonly NamedPlugin[]): void {
  const api = plugins.find(({ name }) => name === VUE_PLUGIN)?.api as VueApi | undefined;
  const options = api?.options;
  if (!api || !options || options.script?.fs != null) return;
  api.options = { ...options, script: { ...options.script, fs: NODE_SCRIPT_FS } };
}
