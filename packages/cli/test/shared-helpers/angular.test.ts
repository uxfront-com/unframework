import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Angular prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Angular", () => {
  it("prints its helpers inline, in each component", async () => {
    const written = await buildFixture("angular");
    expectInline(
      written,
      ["cards/card.ts", "badges/badge.ts"],
      ["ScopeAttributes", "Transition", "TransitionRegion"],
    );
    expectInline(written, ["v-mark.ts"], ["queueHook"]);
  });
});
