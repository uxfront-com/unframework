import type { Target } from "@unframework/codegen";
import angular from "@unframework/target-angular";
import astro from "@unframework/target-astro";
import qwik from "@unframework/target-qwik";
import react from "@unframework/target-react";
import solid from "@unframework/target-solid";
import svelte from "@unframework/target-svelte";
import vue from "@unframework/target-vue";

/** The names of the built-in targets. */
export type TargetName = "react" | "vue" | "svelte" | "solid" | "angular" | "qwik" | "astro";

/** The built-in targets, in the order the docs and reports list them. */
export const TARGET_NAMES: readonly TargetName[] = [
  "react",
  "vue",
  "svelte",
  "solid",
  "angular",
  "qwik",
  "astro",
];

/** The built-in targets by name. */
export const builtinTargets: Readonly<Record<TargetName, Target>> = {
  react,
  vue,
  svelte,
  solid,
  angular,
  qwik,
  astro,
};

/** Resolves a target name, or passes a target object through (third-party targets). */
export function resolveTarget(target: TargetName | Target): Target {
  if (typeof target !== "string") return target;
  // Own names only: `toString` is not a target.
  if (!Object.hasOwn(builtinTargets, target)) {
    throw new TypeError(`Unknown target "${target}".`);
  }
  return builtinTargets[target];
}
