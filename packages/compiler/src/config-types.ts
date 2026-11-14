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
 * name, nothing, a list of them, or a promise of one. This file imports nothing, so Vite's own `PluginOption`, which
 * every Vite plugin matches, stands here as its shape (ADR-0104).
 */
export type VitePluginOption =
  | { readonly name: string }
  | false
  | null
  | undefined
  | readonly VitePluginOption[]
  | PromiseLike<VitePluginOption>;

/**
 * Which fonts may draw text in a live capture (ADR-0105): `bundled`, the bundled Inter alone, by
 * default, or `any`, so a design system's own font passes.
 */
export type LiveFonts = "bundled" | "any";

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
   * The Vite plugins that resolve the modules the outputs import and the project serves itself,
   * such as a styling engine's `virtual:` modules (ADR-0064). `unframework test`, `visual` and
   * `preview` add them, before the unframework plugin, to every Vite server they start. A
   * function, which each server calls for a fresh set, since a plugin may hold one server's state
   * (ADR-0104).
   */
  vitePlugins?: () => VitePluginOption | Promise<VitePluginOption>;
  /**
   * Ambient declaration files, relative to the config's directory, that type those modules, such
   * as a styling engine's generated `.d.ts`: a checker that compiles the outputs reads them, as
   * Angular's does (ADR-0104).
   */
  declarations?: readonly string[];
  /**
   * Which fonts may draw text when pixels compare live: `bundled` by default. Committed baselines
   * always take the bundled font alone (ADR-0105).
   */
  liveFonts?: LiveFonts;
}
