import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Svelte prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Svelte", () => {
  it("prints its helpers inline, in each component", async () => {
    const written = await buildFixture("svelte");
    expectInline(
      written,
      ["cards/Card.svelte", "badges/Badge.svelte"],
      ["scopeAttributes", "transitionClasses", "enter", "leave"],
    );
  });
});
