// @unframework/testing: the cross-target test API (plan §7.3, DESIGN §4.3). One spec, written
// once, runs in every `browser:<target>` project; the project's setup files install the
// determinism, the console capture and the target's mount adapter.
import { describe } from "vitest";

import { currentTarget } from "./browser/target.ts";

export { allowConsole, capturedConsole } from "./browser/console.ts";
export type { ConsoleEntry } from "./browser/console.ts";
export type { ParityOptions } from "./browser/parity.ts";
export { currentTarget, registerTarget } from "./browser/target.ts";
export { cleanup, mount, mountScenario } from "./browser/view.ts";
export type { ComponentMountOptions, NotAFunction, Props, View } from "./browser/view.ts";
export type { CaseConfig, HarnessContext, SsrScenario } from "./harness.ts";
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
export type { PixelTolerance } from "./visual-types.ts";
export type {
  MountAdapter,
  MountedComponent,
  MountOptions,
  RenderReport,
} from "@unframework/codegen";

/** `describe()` with the project's target in the title, so reports tell the targets apart. */
export function describeTargets(name: string, fn: () => void): void {
  describe(`${name} [${currentTarget()}]`, fn);
}
