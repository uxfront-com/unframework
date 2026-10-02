// The targets a run verifies and their toolchains. Toolchains load lazily, one per project, so a
// target whose toolchain cannot load fails its own projects (loudly) and no other.
import type { Toolchain } from "@unframework/codegen";
import { TARGET_NAMES } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";

/** The reference target (D10): Vue's semantics are the source language's. */
export const REFERENCE: TargetName = "vue";

/**
 * The targets this run verifies: every built-in target, or the comma-separated `UF_TARGETS`
 * (`UF_TARGETS=vue,react`). An unknown name throws, so a typo never verifies nothing.
 */
export function selectTargets(value: string | undefined): TargetName[] {
  if (!value?.trim()) return [...TARGET_NAMES];
  const requested = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const unknown = requested.filter((name) => !TARGET_NAMES.includes(name as TargetName));
  if (unknown.length) {
    throw new Error(
      `UF_TARGETS names unknown target(s): ${unknown.join(", ")}. The targets are ${TARGET_NAMES.join(", ")}.`,
    );
  }
  return TARGET_NAMES.filter((name) => requested.includes(name));
}

/** Loads a target's toolchain (`@unframework/target-<t>/toolchain`). */
export async function loadToolchain(target: string): Promise<Toolchain> {
  let module: { toolchain?: Toolchain; default?: Toolchain };
  try {
    module = (await import(
      /* @vite-ignore */ `@unframework/target-${target}/toolchain`
    )) as typeof module;
  } catch (error) {
    throw new Error(
      `The ${target} toolchain (@unframework/target-${target}/toolchain) could not be loaded.`,
      {
        cause: error,
      },
    );
  }
  const toolchain = module.toolchain ?? module.default;
  if (!toolchain || toolchain.name !== target) {
    throw new Error(
      `@unframework/target-${target}/toolchain must export \`toolchain\` with name "${target}".`,
    );
  }
  return toolchain;
}
