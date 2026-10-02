// @unframework/testing/node: the Node side of the testing API (DESIGN §4.3–§4.6). The browser
// commands, the artefact write policy as plain functions for the Node drivers (compile, SSR),
// the run's mode and project ordering, the parity reporter and the summary writer.
export { parityBrowser, VIEWPORT } from "./browser.ts";
export type { AnyBrowserCommand, ParityBrowserOptions } from "./browser.ts";
export { browserCommands, ufAriaSnapshot, ufArtefact } from "./commands.ts";
export type { AriaCommandContext } from "./commands.ts";
export { caseDirectory, displayRoot, projectHarness, sharedArtefactContext } from "./context.ts";
export type { CommandProject } from "./context.ts";
export {
  buildCells,
  buildPartialMatrix,
  cellHeadline,
  cellOf,
  MATRIX_VERSION,
  mergeCells,
  mergeMatrices,
  narrowing,
  outcomeOfCell,
  settleQuarantine,
  stringifyMatrix,
  withoutProjects,
} from "./matrix.ts";
export type {
  MatrixCells,
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
export { ParityReporter, readPartialMatrices, runName } from "./reporter.ts";
export type { ParityReporterOptions } from "./reporter.ts";
export { renderMarkdown, summarise, writeSummary } from "./summary.ts";
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
export { caseOfFile, isReference, ssrScenarios } from "../harness.ts";
export type { CaseConfig, HarnessContext, PixelMode, SsrScenario } from "../harness.ts";
export {
  checkLayers,
  LAYERS,
  LayerFailure,
  layerFailures,
  mergeOutcomes,
  quarantineFor,
  recordLayer,
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
