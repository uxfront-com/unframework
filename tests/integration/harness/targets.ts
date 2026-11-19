// The targets a run verifies and their toolchains. Toolchains load lazily, one per project, so a
// target whose toolchain cannot load fails its own projects (loudly) and no other.
import { capabilitiesOf } from "@unframework.dev/codegen";
import type { Capabilities, Target, Toolchain } from "@unframework.dev/codegen";
import { builtinTargets, TARGET_NAMES } from "@unframework.dev/compiler";
import type { TargetName } from "@unframework.dev/compiler";

/** The reference target (D10): Vue's semantics are the source language's. */
export const REFERENCE: TargetName = "vue";

/**
 * A built-in target compiled with options of its own, which the corpus verifies as a target of
 * its own (ADR-0112): its id names its projects, its toolchain directory, its quarantine, its
 * `__output__/<id>/` tree and its diagnostics, and it compiles as `target` with `options`. It is
 * test plumbing, not a selector a project can name: a project sets `targetOptions`.
 */
export interface OptionSet {
  target: TargetName;
  options: Readonly<Record<string, unknown>>;
  /** The toolchain's module: `@unframework.dev/target-<target>/<toolchain>`. */
  toolchain: string;
}

/** The option sets the corpus runs, by id. Never the reference: Vue stays the one. */
export const OPTION_SETS: Readonly<Record<string, OptionSet>> = {
  // Vue 3.6's Vapor components, from tests/toolchains/vue-vapor (ADR-0112).
  "vue-vapor": { target: "vue", options: { vapor: true }, toolchain: "toolchain/vapor" },
};

/** Every target the harness verifies, by id: the built-in targets, then the option sets. */
export const HARNESS_TARGETS: readonly string[] = [...TARGET_NAMES, ...Object.keys(OPTION_SETS)];

/** Whether an id names an option set. */
export function isOptionSet(id: string): boolean {
  return Object.hasOwn(OPTION_SETS, id);
}

/** What a target's id compiles as: its built-in target, and the options it compiles with. */
export function compiledAs(id: string): {
  target: TargetName;
  targetOptions?: Partial<Record<TargetName, unknown>>;
} {
  const set = isOptionSet(id) ? OPTION_SETS[id]! : undefined;
  if (set) return { target: set.target, targetOptions: { [set.target]: set.options } };
  if (!Object.hasOwn(builtinTargets, id)) throw new Error(`No target is named "${id}".`);
  return { target: id as TargetName };
}

/** The built-in target object an id compiles with, or `undefined` for an unknown id. */
export function builtinOf(id: string): Target | undefined {
  const target = isOptionSet(id) ? OPTION_SETS[id]!.target : id;
  return Object.hasOwn(builtinTargets, target) ? builtinTargets[target as TargetName] : undefined;
}

/**
 * A target's capability matrix, by id: an option set's is its target's under its options
 * (`capabilitiesOf`), so a cell its options change reads as it compiles. `undefined` for an
 * unknown id.
 */
export function capabilitiesOfTarget(id: string): Capabilities | undefined {
  const target = builtinOf(id);
  if (!target) return undefined;
  return capabilitiesOf(target, isOptionSet(id) ? OPTION_SETS[id]!.options : undefined);
}

/**
 * The targets this run verifies: every built-in target, then every option set, or the
 * comma-separated `UF_TARGETS` (`UF_TARGETS=vue,vue-vapor`). An unknown name throws, so a typo
 * never verifies nothing.
 */
export function selectTargets(value: string | undefined): string[] {
  if (!value?.trim()) return [...HARNESS_TARGETS];
  const requested = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const unknown = requested.filter((name) => !HARNESS_TARGETS.includes(name));
  if (unknown.length) {
    throw new Error(
      `UF_TARGETS names unknown target(s): ${unknown.join(", ")}. The targets are ${HARNESS_TARGETS.join(", ")}.`,
    );
  }
  return HARNESS_TARGETS.filter((name) => requested.includes(name));
}

/**
 * Loads a target's toolchain (`@unframework.dev/target-<t>/toolchain`), or an option set's
 * (`OptionSet.toolchain`), whose name is the set's id.
 */
export async function loadToolchain(target: string): Promise<Toolchain> {
  const set = isOptionSet(target) ? OPTION_SETS[target]! : undefined;
  const specifier = set
    ? `@unframework.dev/target-${set.target}/${set.toolchain}`
    : `@unframework.dev/target-${target}/toolchain`;
  let module: { toolchain?: Toolchain; default?: Toolchain };
  try {
    module = (await import(/* @vite-ignore */ specifier)) as typeof module;
  } catch (error) {
    throw new Error(`The ${target} toolchain (${specifier}) could not be loaded.`, {
      cause: error,
    });
  }
  const toolchain = module.toolchain ?? module.default;
  if (!toolchain || toolchain.name !== target) {
    throw new Error(`${specifier} must export \`toolchain\` with name "${target}".`);
  }
  return toolchain;
}
