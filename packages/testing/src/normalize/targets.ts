/** The built-in targets whose output the normaliser knows. */
export const NORMALIZE_TARGETS: readonly [
  "react",
  "vue",
  "svelte",
  "solid",
  "solid2",
  "angular",
  "qwik",
  "astro",
] = ["react", "vue", "svelte", "solid", "solid2", "angular", "qwik", "astro"];

/** A target the normaliser knows the framework noise of. */
export type NormalizeTarget = (typeof NORMALIZE_TARGETS)[number];

/** Whether `target` names one of the built-in targets (a stub or third-party target does not). */
export function isNormalizeTarget(target: string): target is NormalizeTarget {
  return (NORMALIZE_TARGETS as ReadonlyArray<string>).includes(target);
}
