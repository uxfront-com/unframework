import type { CapabilityCell } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import { ssrSkip } from "./ssr-skip.ts";

const cells: Record<string, CapabilityCell> = {
  context: { support: "unsupported", code: "UF4001", severity: "warning", reason: "No tree." },
  interactivity: { support: "unsupported", code: "UF4001", severity: "info", reason: "Static." },
  "use-id": { support: "native" },
};

describe("ssrSkip", () => {
  it("skips a case whose every test requires a capability the target leaves unsupported", () => {
    expect(
      ssrSkip([{ requires: ["context"] }, { requires: ["interactivity", "context"] }], cells),
    ).toBe("requires context: No tree.");
  });

  it("renders a case with a test that does not require it", () => {
    expect(ssrSkip([{ requires: ["context"] }, { requires: [] }], cells)).toBeUndefined();
  });

  it("renders a case whose every test requires only a behavioural capability", () => {
    expect(ssrSkip([{ requires: ["interactivity"] }], cells)).toBeUndefined();
  });

  it("renders a case whose shared capability the target supports, or that has no tests", () => {
    expect(ssrSkip([{ requires: ["use-id"] }], cells)).toBeUndefined();
    expect(ssrSkip([], cells)).toBeUndefined();
  });
});
