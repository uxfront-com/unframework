import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Solid prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Solid", () => {
  it("prints its helpers inline, in each component", async () => {
    const written = await buildFixture("solid");
    expectInline(
      written,
      ["cards/Card.tsx", "badges/Badge.tsx"],
      ["cx", "scopeAttributes", "Transition"],
    );
    expectInline(written, ["vMark.ts"], ["queueHook"]);
  });
});
