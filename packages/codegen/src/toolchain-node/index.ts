// `@unframework/codegen/toolchain-node`: the Node-only helpers the targets' toolchains share
// (plan §5.7). They live in the target kit because targets share a layer and cannot import each
// other. Codegen's main entry never imports this subpath: it stays free of Node APIs.
export {
  assertFilesToCheck,
  assertFilesToCompile,
  checkerFailed,
  diagnosticsByFile,
  runChecker,
} from "./checker.ts";
export type { CheckerRun, DiagnosticsByFile, ProcessRun } from "./checker.ts";
export { lintWithEslint, lintWithOxlint, mergeLintResults } from "./lint.ts";
export type { EslintOptions, LintOptions } from "./lint.ts";
export { resolveInstalled, resolveToolBin } from "./resolve.ts";
export { typecheckWithTsgo } from "./tsgo.ts";
