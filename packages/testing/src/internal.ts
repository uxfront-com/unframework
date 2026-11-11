// @unframework/testing/harness: the browser side of the harness's machinery (ADR-0085). The
// target entries register their adapters through it, the setup and the package's own tests use
// it, and a spec never imports it: the lint rule on tests/integration/cases refuses the subpath.
// The Node side is `./node`.
export { registerTarget } from "./browser/target.ts";
export type { TargetOptions } from "./browser/target.ts";
export { cleanup } from "./browser/view.ts";
export type { HarnessContext } from "./harness.ts";
export { checkLayers, LAYERS, LayerFailure, recordLayer } from "./layers.ts";
export type {
  LayerCheck,
  LayerName,
  LayerOutcome,
  LayerSkip,
  LayerSubject,
  QuarantineEntry,
  UfLayerMeta,
} from "./layers.ts";
export type {
  MountAdapter,
  MountedComponent,
  MountEvent,
  MountListener,
  MountOptions,
  RenderReport,
} from "@unframework/codegen";
