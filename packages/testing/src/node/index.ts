// @unframework/testing/node: the Node side of the testing API (plan §7.3, §7.4). The browser
// commands, the artefact write policy as plain functions for the Node drivers (compile, SSR),
// the run's mode and project ordering, the parity reporter and the summary writer.
export { ACTION_TIMEOUT, parityBrowser, VIEWPORT } from "./browser.ts";
export type { AnyBrowserCommand, ParityBrowserOptions } from "./browser.ts";
export {
  browserCommands,
  ufAriaSnapshot,
  ufArtefact,
  ufComponentEvents,
  ufFocus,
  ufResetInput,
} from "./commands.ts";
export type { AriaCommandContext, FocusCommandContext, InputCommandContext } from "./commands.ts";
export { compiledEvents, eventsOfModule, recordCompiledModule } from "./events.ts";
export type { CompiledModule } from "./events.ts";
export { caseDirectory, displayRoot, projectHarness, sharedArtefactContext } from "./context.ts";
export type { CommandProject } from "./context.ts";
export {
  buildCells,
  buildPartialMatrix,
  buildTests,
  cellHeadline,
  cellOf,
  MATRIX_VERSION,
  mergeCells,
  mergeMatrices,
  mergeTests,
  narrowing,
  outcomeOfCell,
  settleQuarantine,
  stringifyMatrix,
  withoutProjects,
} from "./matrix.ts";
export type {
  MatrixCells,
  MatrixTest,
  MatrixTests,
  MergedMatrix,
  ParityMatrix,
  PartialMatrix,
  ProjectRecord,
  RunInfo,
  RunMode,
  Shard,
} from "./matrix.ts";
export { BASELINE_ENVIRONMENT, createHarnessRun, groupOrder, resolveHarnessMode } from "./mode.ts";
export type { HarnessMode, HarnessRunOptions, ModeInput, ProjectKind } from "./mode.ts";
export { KEBAB_CASE } from "./names.ts";
export { settleArtefact, settleArtefactDirectory, writeIfChanged } from "./policy.ts";
export type { ArtefactContext, ArtefactOutcome, ArtefactRole, ArtefactStatus } from "./policy.ts";
export { ParityReporter, readPartialMatrices, runName, testKey } from "./reporter.ts";
export type { ParityReporterOptions } from "./reporter.ts";
export { renderMarkdown, summarise, unacceptedSkip, writeSummary } from "./summary.ts";
export type {
  SummaryExpectations,
  SummaryJudgement,
  SummaryOptions,
  SummaryResult,
} from "./summary.ts";
export { ALLOWED_FONTS, diffGeometry, formatGeometryDiff, ufVisualCapture } from "./visual.ts";
export type { GeometryDelta, VisualCommandContext } from "./visual.ts";
export { formatConsoleArgs } from "../browser/console.ts";
export { diffLines } from "../diff.ts";
export type { DiffOptions } from "../diff.ts";
export { formatError } from "../errors.ts";
export {
  caseOfFile,
  caseReference,
  caseReferences,
  isReference,
  ssrScenarios,
} from "../harness.ts";
export type { CaseConfig, HarnessContext, PixelMode, SsrScenario } from "../harness.ts";
export {
  checkLayers,
  LAYERS,
  LayerFailure,
  layerFailures,
  mergeOutcomes,
  NO_INTERACTION_SKIP,
  NO_OUTPUT_SKIP,
  NO_OUTPUT_TEST_SKIP,
  noOutputSkip,
  NOT_RENDERED_SKIP,
  quarantineFor,
  recordLayer,
  REQUIRES_SKIP,
  requiresSkip,
  settleOutcome,
} from "../layers.ts";
export type {
  LayerCheck,
  LayerName,
  LayerOutcome,
  LayerSkip,
  LayerSubject,
  LayerTask,
  QuarantineEntry,
  UfLayerMeta,
} from "../layers.ts";
export { LIVE_REFERENCE_SKIP } from "../visual-types.ts";
export type {
  CaptureAttachment,
  CaptureOutcome,
  CaptureRequest,
  CaptureResult,
  GeometrySnapshot,
  PixelTolerance,
} from "../visual-types.ts";
