import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Astro prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Astro", () => {
  it("prints its helpers inline, in each component", async () => {
    const written = await buildFixture("astro");
    expectInline(written, ["cards/Card.astro", "badges/Badge.astro"], ["scopeAttributes"]);
  });
});
