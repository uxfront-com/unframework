import type { Target } from "@unframework.dev/codegen";
import angular from "@unframework.dev/target-angular";
import astro from "@unframework.dev/target-astro";
import qwik from "@unframework.dev/target-qwik";
import react from "@unframework.dev/target-react";
import solid from "@unframework.dev/target-solid";
import svelte from "@unframework.dev/target-svelte";
import vue from "@unframework.dev/target-vue";

import type { TargetName } from "./config-types.ts";

export type { TargetName };

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
