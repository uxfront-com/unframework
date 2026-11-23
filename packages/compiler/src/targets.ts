import type { Target } from "@unframework.dev/codegen";
import angular from "@unframework.dev/target-angular";
import astro from "@unframework.dev/target-astro";
import ember from "@unframework.dev/target-ember";
import qwik from "@unframework.dev/target-qwik";
import react from "@unframework.dev/target-react";
import solid from "@unframework.dev/target-solid";
import solid2 from "@unframework.dev/target-solid2";
import svelte from "@unframework.dev/target-svelte";
import vue from "@unframework.dev/target-vue";

import type { TargetName, TargetSelector } from "./config-types.ts";

export type { TargetName, TargetSelector };

/** The built-in targets, in the order the docs and reports list them. */
export const TARGET_NAMES: readonly TargetName[] = [
  "react",
  "vue",
  "svelte",
  "solid",
  "solid2",
  "angular",
  "qwik",
  "astro",
  "ember",
];

/**
 * The targets a configuration without `targets` compiles to: every built-in but `solid2`, which
 * is opt-in, since a project that selects both Solid majors needs two Solid installs (ADR-0102),
 * and `ember`, which is opt-in while it emits only part of the language.
 */
export const DEFAULT_TARGETS: readonly TargetName[] = TARGET_NAMES.filter(
  (name) => name !== "solid2" && name !== "ember",
);

/**
 * The selectors that name a framework's major, and the target each selects (ADR-0102), the newest
 * first: a major that doesn't exist (`solid@3`) is as close to each, and the hint names the first.
 */
const VERSIONED: Readonly<Record<Exclude<TargetSelector, TargetName>, TargetName>> = {
  "solid@2": "solid2",
  "solid@1": "solid",
};

/** Every selector a configuration or the CLI accepts: the ids, then the versioned forms. */
export const TARGET_SELECTORS: readonly TargetSelector[] = [
  ...TARGET_NAMES,
  ...(Object.keys(VERSIONED) as (keyof typeof VERSIONED)[]),
];

/** Whether a string selects a built-in target. Own names only: `toString` is not a target. */
export function isTargetSelector(value: string): value is TargetSelector {
  return Object.hasOwn(builtinTargets, value) || Object.hasOwn(VERSIONED, value);
}

/** The id of the target a selector selects: `solid@2` is `solid2`, `solid@1` is `solid`. */
export function targetName(selector: TargetSelector): TargetName {
  return Object.hasOwn(VERSIONED, selector)
    ? VERSIONED[selector as keyof typeof VERSIONED]
    : (selector as TargetName);
}

/** The built-in targets by name. */
export const builtinTargets: Readonly<Record<TargetName, Target>> = {
  react,
  vue,
  svelte,
  solid,
  solid2,
  angular,
  qwik,
  astro,
  ember,
};

/** Resolves a target selector, or passes a target object through (third-party targets). */
export function resolveTarget(target: TargetSelector | Target): Target {
  if (typeof target !== "string") return target;
  // A string a JavaScript caller passed, which the type rules out.
  const name: string = target;
  if (!isTargetSelector(name)) throw new TypeError(`Unknown target "${name}".`);
  return builtinTargets[targetName(name)];
}
