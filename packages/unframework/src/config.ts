/**
 * `unframework/config` (plan §8.1, ADR-0016): what a project's `unframework.config.ts` imports. Its
 * one import is type-only, so importing this loads no compiler, and it names the compiler's leaf of
 * config types, so that type-checking it reads none either (ADR-0076).
 */
import type { UnframeworkConfig } from "@unframework.dev/compiler/config-types";

export type { UnframeworkConfig };

/** Types a configuration, and returns it as it is. */
export function defineConfig(config: UnframeworkConfig): UnframeworkConfig {
  return config;
}
