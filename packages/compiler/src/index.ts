export { checkHelperRoot, checkPassThrough, compile } from "./compile.ts";
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
export type {
	ConfigOrigin,
	LoadedConfig,
	ResolveConfigResult,
	ResolvedConfig,
	ResolvedPackageConfig,
} from "./config.ts";
export type {
	PackageConfig,
	ProjectViteConfig,
	UnframeworkConfig,
	ViteContext,
	ViteMode,
	VitePluginOption,
} from "./config-types.ts";
export { DEFAULT_PASS_THROUGH } from "@unframework.dev/analyzer";
export {
	builtinTargets,
	DEFAULT_TARGETS,
	isTargetSelector,
	resolveTarget,
	TARGET_NAMES,
	TARGET_SELECTORS,
	targetName,
} from "./targets.ts";
export type { TargetName, TargetSelector } from "./targets.ts";
export { checkCapabilities } from "./capabilities.ts";
export { requiredCapabilities } from "@unframework.dev/codegen";
export type { OutputFile, Target } from "@unframework.dev/codegen";
export type { Diagnostic } from "@unframework.dev/diagnostics";
export type { UfModule } from "@unframework.dev/ir";
