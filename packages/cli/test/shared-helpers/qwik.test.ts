import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Qwik prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Qwik", () => {
  it("prints its helpers inline, in each component", async () => {
    const written = await buildFixture("qwik");
    expectInline(
      written,
      ["cards/Card.tsx", "badges/Badge.tsx"],
      ["scopeAttributes", "runTransition", "queueHook"],
    );
  });
});
