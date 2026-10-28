export { checkPassThrough, compile } from "./compile.ts";
export { createFileResolver } from "./resolver.ts";
// The harness and the unplugin build their file-backed oracle from it (ADR-0067).
export { createSyntacticOracle } from "@unframework/type-oracle";
export type { SyntacticOracleOptions, TypeOracle } from "@unframework/type-oracle";
export type {
  FileResolverOptions,
  ResolvedModule,
  ResolvedStylesheet,
  ResolveRequest,
  Resolver,
} from "./resolver.ts";
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
