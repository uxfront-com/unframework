// @unframework.dev/testing: the cross-target test API (plan §7.3, §8.5). One spec, written once, runs
// in every `browser:<target>` project; the project's setup files install the determinism, the
// console capture, the matchers and the target's mount adapter.
//
// This entry is the public surface, exactly (ADR-0085): a name added here is a promise to every
// project's specs, and tests/repo/test/testing-api.test.ts fails until the ADR's list has it. The
// harness's machinery is the `./harness` subpath, which specs never import.
import { describe } from "vitest";

import { currentTarget } from "./browser/target.ts";

export { allowConsole, capturedConsole } from "./browser/console.ts";
export type { ConsoleEntry } from "./browser/console.ts";
export type { NoAxeViolationsOptions } from "./browser/matchers.ts";
export type { ParityOptions } from "./browser/parity.ts";
export { it, test } from "./browser/spec.ts";
export type { SpecOptions, SpecTest } from "./browser/spec.ts";
export type { ViewClock } from "./browser/clock.ts";
export { currentTarget } from "./browser/target.ts";
export type { TraceStep } from "./browser/trace.ts";
export type { ClickOptions, ViewUser } from "./browser/user.ts";
export { mount, mountScenario } from "./browser/view.ts";
export type {
  ComponentMountOptions,
  NotAFunction,
  Props,
  View,
  ViewOptions,
} from "./browser/view.ts";
export type { CaseConfig, SsrScenario } from "./harness.ts";
export type { PixelTolerance } from "./visual-types.ts";

/** `describe()` with the project's target in the title, so reports tell the targets apart. */
export function describeTargets(name: string, fn: () => void): void {
  describe(`${name} [${currentTarget()}]`, fn);
}
