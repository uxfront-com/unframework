// Which target an app's Vite configuration asks for, and what in it the outputs can't work with
// (plan §8.2, ADR-0075, ADR-0026). Both read the plugins by the names they register, which are the
// framework plugins' own: none of them is a dependency of this package.
import { readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { TargetName } from "@unframework.dev/compiler";
import { createDiagnostic, formatDiagnostic } from "@unframework.dev/diagnostics";

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
  // Solid 1's vite-plugin-solid and Solid 2's @solidjs/vite-plugin both register "solid": the
  // `solid-js` the app resolves tells them apart (ADR-0102).
  solid: (name) => name === "solid",
  solid2: (name) => name === "solid",
  angular: (name) => name === "@analogjs/vite-plugin-angular",
  qwik: (name) => name === "vite-plugin-qwik",
  astro: (name) => name.startsWith("astro:"),
};

// A configuration is no source: these have no position to point at.
const NO_SPAN = { start: 0, end: 0 };

/**
 * The major of the `solid-js` that resolves from `root`, or `undefined` when none does. Read from
 * its `package.json`, so neither Solid build loads.
 */
export function solidMajor(root: string): number | undefined {
  try {
    const manifest = createRequire(join(root, "package.json")).resolve("solid-js/package.json");
    const { version } = JSON.parse(readFileSync(manifest, "utf8")) as { version?: unknown };
    const major = typeof version === "string" ? Number.parseInt(version, 10) : Number.NaN;
    return Number.isNaN(major) ? undefined : major;
  } catch {
    return undefined;
  }
}

/**
 * The one target whose framework's plugin is among `plugins`, or the UF7005 or UF7006 message that
 * says why there isn't one. `file` names the configuration in the message. The `"solid"` plugin is
 * Solid 2's when the `solid-js` that resolves from `root` is 2.x, and Solid 1's otherwise, as it
 * was before `solid@2` (ADR-0102).
 */
export function detectTarget(
  plugins: readonly NamedPlugin[],
  file: string,
  root: string = process.cwd(),
): { target: TargetName } | { error: string } {
  const names = plugins.flatMap(({ name }) => (typeof name === "string" ? [name] : []));
  let solid: TargetName | undefined;
  const found = Object.entries(FRAMEWORK_PLUGINS).flatMap(([target, belongs]) => {
    const plugin = names.find((name) => belongs(name));
    if (!plugin) return [];
    if (target === "solid" || target === "solid2") {
      solid ??= solidMajor(root) === 2 ? "solid2" : "solid";
      if (target !== solid) return [];
    }
    return [{ target: target as TargetName, plugin }];
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
  /** The `vue/compiler-sfc` plugin-vue compiles with, once given or resolved (UF7013). */
  compiler?: unknown;
}

/** plugin-vue's `api`, whose `options` is a getter and a setter over the options it compiles with. */
interface VueApi {
  options?: VueOptions;
}

/** plugin-vue's `api`, found by the name it registers. */
const vueApiOf = (plugins: readonly NamedPlugin[]): VueApi | undefined =>
  plugins.find(({ name }) => name === VUE_PLUGIN)?.api as VueApi | undefined;

/**
 * The UF7010 message for plugin-vue's whitespace option, when it is `"preserve"`: the printer lays
 * a template out for `"condense"`, and the option can't be set per file (ADR-0026).
 */
export function hostOptionWarning(
  plugins: readonly NamedPlugin[],
  file: string,
): string | undefined {
  const whitespace = vueApiOf(plugins)?.options?.template?.compilerOptions?.whitespace;
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

/** Whether the Vue target's options, as given, turn `vapor` on (ADR-0112). */
export function vaporOn(options: unknown): boolean {
  return (
    typeof options === "object" && options !== null && "vapor" in options && options.vapor === true
  );
}

/** What UF7013 reads of a `vue/compiler-sfc`: its version, and how it parses a Vapor file. */
interface CompilerSfc {
  version?: unknown;
  parse(source: string): { descriptor: { vapor?: unknown } };
}

/**
 * Whether a `vue/compiler-sfc` reads `<script setup vapor>` as a Vapor component, as Vue 3.6's
 * does: an older one ignores the attribute and compiles the virtual DOM (ADR-0112). It parses a
 * Vapor file rather than reading the version, so a release that reads it passes whatever its
 * number. Also used by the CLI's Vue packager.
 */
export function compilesVapor(compiler: unknown): boolean {
  if (typeof (compiler as Partial<CompilerSfc> | null)?.parse !== "function") return false;
  try {
    const { descriptor } = (compiler as CompilerSfc).parse(
      '<script setup vapor lang="ts"></script>\n<template><p></p></template>\n',
    );
    return descriptor.vapor === true;
  } catch {
    return false;
  }
}

/**
 * The UF7013 message when `targetOptions.vue.vapor` is on and the `vue/compiler-sfc` that
 * plugin-vue compiles with doesn't compile Vapor components (ADR-0112): its own `compiler` option,
 * or the one it resolves from the root, as plugin-vue does without it. Without plugin-vue there is
 * nothing to check.
 */
export function vaporCompilerError(
  plugins: readonly NamedPlugin[],
  file: string,
  root: string,
): string | undefined {
  const api = vueApiOf(plugins);
  if (!api) return undefined;
  let compiler = api.options?.compiler;
  let from = "plugin-vue's `compiler` option";
  if (compiler === undefined) {
    from = `the \`vue/compiler-sfc\` of ${root}`;
    try {
      compiler = createRequire(join(root, "package.json"))("vue/compiler-sfc");
    } catch {
      compiler = undefined;
    }
  }
  if (compilesVapor(compiler)) return undefined;
  const version = (compiler as Partial<CompilerSfc> | undefined)?.version;
  const diagnostic = createDiagnostic("UF7013", {
    file,
    span: NO_SPAN,
    message: `\`targetOptions.vue.vapor\` is on, and ${from}${typeof version === "string" ? `, Vue ${version},` : ""} doesn't compile Vapor components: it would build virtual-DOM components with no warning.`,
    help: "Install Vue 3.6 or later where plugin-vue resolves it, or turn `vapor` off.",
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
  const api = vueApiOf(plugins);
  const options = api?.options;
  if (!api || !options || options.script?.fs != null) return;
  api.options = { ...options, script: { ...options.script, fs: NODE_SCRIPT_FS } };
}
