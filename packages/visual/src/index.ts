// @unframework.dev/visual (plan §8.6, ADR-0087): a project's examples on every target, compared
// geometry first and pixels second, live or against baselines beside each example, with the run's
// data in `report.json`. `unframework visual` runs it; `./browser` is what each generated spec
// imports. `startPreview` shows every example and component side by side on every target, for
// development (ADR-0088).
export { BASELINE_COMMAND, exampleLocation, takeCaptures, ufExampleCapture } from "./command.ts";
export type { ExampleCaptureRequest, VisualContext } from "./command.ts";
export {
  checkExamples,
  discoverExamples,
  EXAMPLE_SUFFIX,
  exampleBaselines,
  SKIPPED_DIRECTORIES,
} from "./examples.ts";
export type { DiscoverExamplesOptions, Example, ExampleBaselines } from "./examples.ts";
export { buildReport, cellKey, formatReport, REPORT_VERSION } from "./report.ts";
export { MAX_DELTA_ROWS, renderReport } from "./report-page.ts";
export type {
  MissingCapture,
  RecordedCapture,
  ReportInput,
  VisualCell,
  VisualExample,
  VisualImages,
  VisualReport,
  VisualStatus,
} from "./report.ts";
export {
  checkRunDirectory,
  DEFAULT_OUT,
  RUN_MARKER,
  runVisual,
  SPECS_DIR,
  VisualUsageError,
  writeSpecs,
} from "./run.ts";
export type { VisualRunOptions, VisualRunResult } from "./run.ts";
export { startPreview } from "./preview/index.ts";
export type { Preview, PreviewOptions } from "./preview/index.ts";
