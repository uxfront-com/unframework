// The capability checks the browser runs (ADR-0050), on matrices of their own: the skip reason
// of the first unsupported capability a test requires, the refusal of an interaction on a
// target that runs no client code, and the skip of a test of a case the target has no output
// for.
import type { CapabilityCell } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import {
  assertInteractive,
  capabilityCell,
  noOutputReason,
  requiredSkip,
} from "../src/browser/capabilities.ts";

const inert: CapabilityCell = {
  support: "unsupported",
  code: "UF4001",
  severity: "info",
  reason: "components render on the server only",
};
const astro: Record<string, CapabilityCell> = {
  element: { support: "native" },
  "use-id": { support: "emulated", helper: "useId" },
  interactivity: inert,
};
const vue: Record<string, CapabilityCell> = { ...astro, interactivity: { support: "native" } };

describe("requiredSkip", () => {
  it("names the first capability the target lacks, with its reason", () => {
    expect(requiredSkip(["element", "interactivity"], astro)).toBe(
      "requires interactivity: components render on the server only",
    );
    expect(requiredSkip(["use-id", "interactivity"], vue)).toBeUndefined();
    expect(() => requiredSkip(["teleport"], vue)).toThrow(
      '"teleport" is not a capability: the capabilities are element, use-id, interactivity.',
    );
    expect(capabilityCell("use-id", vue)).toEqual({ support: "emulated", helper: "useId" });
  });
});

describe("assertInteractive", () => {
  it("refuses an interaction where nothing runs, saying to declare requires", () => {
    expect(() => assertInteractive("view.user.click", astro, "astro")).toThrow(
      'view.user.click: astro runs no client code (components render on the server only). A test that interacts or reads emitted events declares it: it(name, { requires: ["interactivity"] }, fn).',
    );
    expect(() => assertInteractive("view.emitted", vue, "vue")).not.toThrow();
  });
});

describe("noOutputReason", () => {
  it("skips every test of a case the target has no output for, with the errors it expects", () => {
    const cases = {
      "events/conditional-controls":
        "UF4001 (The qwik target does not support conditional-event-control: …)",
    };
    expect(noOutputReason("events/conditional-controls", cases)).toBe(
      "no output: UF4001 (The qwik target does not support conditional-event-control: …)",
    );
    expect(noOutputReason("events/keys", cases)).toBeUndefined();
    expect(noOutputReason("constructor", cases)).toBeUndefined();
    // Outside the harness nothing is provided: every case has output.
    expect(noOutputReason("events/keys", undefined)).toBeUndefined();
  });
});
