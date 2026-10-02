export { compile } from "./compile.ts";
export type {
  CompileOptions,
  CompileResult,
  CompilerPlugin,
  OutputHookContext,
} from "./compile.ts";
export { builtinTargets, resolveTarget, TARGET_NAMES } from "./targets.ts";
export type { TargetName } from "./targets.ts";
export { checkCapabilities } from "./capabilities.ts";
export { requiredCapabilities } from "@unframework/codegen";
export type { OutputFile, Target } from "@unframework/codegen";
export type { Diagnostic } from "@unframework/diagnostics";
export type { UfModule } from "@unframework/ir";
