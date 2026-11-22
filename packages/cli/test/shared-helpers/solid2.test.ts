import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Solid 2 prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Solid 2", () => {
  it("prints its helpers inline, in each component", async () => {
    const written = await buildFixture("solid@2", "solid2");
    expectInline(
      written,
      ["cards/Card.tsx", "badges/Badge.tsx"],
      ["cx", "scopeAttributes", "Transition", "createState"],
    );
    expectInline(written, ["vMark.ts"], ["queueHook"]);
  });
});
