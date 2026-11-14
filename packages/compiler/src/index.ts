export { checkPassThrough, compile } from "./compile.ts";
export { createFileResolver, createProject } from "./project.ts";
export type { Project, ProjectOptions, ProjectUpdate } from "./project.ts";
// The harness and the unplugin build their file-backed oracle from it (ADR-0067).
export { createSyntacticOracle } from "@unframework.dev/type-oracle";
export type { SyntacticOracleOptions, TypeOracle } from "@unframework.dev/type-oracle";
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
export { loadConfig, resolveConfig } from "./config.ts";
export type { ConfigOrigin, LoadedConfig, ResolveConfigResult, ResolvedConfig } from "./config.ts";
export type {
  LiveFonts,
  PackageConfig,
  UnframeworkConfig,
  VitePluginOption,
} from "./config-types.ts";
export { builtinTargets, resolveTarget, TARGET_NAMES } from "./targets.ts";
export type { TargetName } from "./targets.ts";
export { checkCapabilities } from "./capabilities.ts";
export { requiredCapabilities } from "@unframework.dev/codegen";
export type { OutputFile, Target } from "@unframework.dev/codegen";
export type { Diagnostic } from "@unframework.dev/diagnostics";
export type { UfModule } from "@unframework.dev/ir";
