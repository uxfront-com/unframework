// The configuration's types, in a file with no imports. `unframework/config` reaches them through
// `@unframework/compiler/config-types`, so that a project's config type-checks without the
// compiler's whole type graph, which `skipLibCheck: false` would hold against it (ADR-0076).

/** The names of the built-in targets. */
export type TargetName = "react" | "vue" | "svelte" | "solid" | "angular" | "qwik" | "astro";

/** The targets packaging covers, and where each packager resolves from (ADR-0076). */
export interface PackageConfig {
  targets?: readonly TargetName[];
  /** One directory, or one per target. */
  resolveFrom?: string | Partial<Record<TargetName, string>>;
}

/** The configuration as a project writes it, with `defineConfig` from `unframework/config`. */
export interface UnframeworkConfig {
  /** Defaults to all seven targets. */
  targets?: readonly TargetName[];
  /** Defaults to `src`, relative to the config's directory. */
  srcDir?: string;
  /** Defaults to `dist`, relative to the config's directory. */
  outDir?: string;
  /** Each target's options, validated through the target's Standard Schema when it has one. */
  targetOptions?: Partial<Record<TargetName, unknown>>;
  /** Defaults to `syntactic`. */
  typeOracle?: "syntactic" | "tsgo";
  /** Plan §8.1: `true` makes portability warnings errors, once the CLI reads it. Defaults to `false`. */
  strict?: boolean;
  package?: PackageConfig;
}
