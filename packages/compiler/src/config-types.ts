// The configuration's types, in a file with no imports. `@uxfront/unframework/config` reaches them through
// `@unframework.dev/compiler/config-types`, so that a project's config type-checks without the
// compiler's whole type graph, which `skipLibCheck: false` would hold against it (ADR-0076).

/** The names of the built-in targets. */
export type TargetName = "react" | "vue" | "svelte" | "solid" | "angular" | "qwik" | "astro";

/** The targets packaging covers, and where each packager resolves from (ADR-0076). */
export interface PackageConfig {
  targets?: readonly TargetName[];
  /** One directory, or one per target. */
  resolveFrom?: string | Partial<Record<TargetName, string>>;
}

/**
 * One entry of Vite's `plugins`, as far as the configuration reads it: a plugin, which has a
 * name, nothing, a list of them, or a promise of one. This file imports nothing, so Vite's own
 * `PluginOption`, which every Vite plugin matches, stands here as its shape (ADR-0104).
 */
export type VitePluginOption =
  | { readonly name: string }
  | false
  | null
  | undefined
  | readonly VitePluginOption[]
  | PromiseLike<VitePluginOption>;

/** The kind of Vite server a project's `vite` config is for (ADR-0104). */
export type ViteMode = "browser" | "ssr" | "preview";

/** What a project's `vite` function is called with: the server's target and its kind. */
export interface ViteContext {
  readonly target: TargetName;
  readonly mode: ViteMode;
}

/**
 * The partial Vite config a project's `vite` function returns, as far as this file can say
 * without importing Vite (ADR-0076): its `plugins` are checked, and any other key Vite's
 * `UserConfig` has passes, whether the function returns an object literal or Vite's own type
 * (ADR-0104).
 */
export type ProjectViteConfig = { plugins?: readonly VitePluginOption[] } & object;

/** The configuration as a project writes it, with `defineConfig` from `@uxfront/unframework/config`. */
export interface UnframeworkConfig {
  /** Defaults to all seven targets. */
  targets?: readonly TargetName[];
  /** Defaults to `src`, relative to the config's directory. */
  srcDir?: string;
  /** Defaults to `dist`, relative to the config's directory. */
  outDir?: string;
  /** Each target's options, validated through its Standard Schema. A target without one takes none. */
  targetOptions?: Partial<Record<TargetName, unknown>>;
  /** Defaults to `syntactic`. */
  typeOracle?: "syntactic" | "tsgo";
  /** Plan §8.1: `true` makes portability warnings errors, in the CLI. Defaults to `false`. */
  strict?: boolean;
  package?: PackageConfig;
  /**
   * The project's Vite config for the servers `unframework test`, `visual` and `preview` start,
   * such as the plugin of a styling engine that serves `virtual:` modules (ADR-0064). Each server
   * calls it with its target and kind, for a fresh set of plugins, since a plugin may hold one
   * server's state. Its plugins are listed before the unframework plugin, and the other keys merge into
   * the server's own config, which it never replaces (ADR-0104).
   */
  vite?: (context: ViteContext) => ProjectViteConfig | Promise<ProjectViteConfig>;
  /**
   * The font families that may draw text when pixels compare live, besides the bundled Inter, as
   * the `font-fallback` message names them. Committed baselines take Inter alone (ADR-0105).
   */
  liveFonts?: readonly string[];
}
