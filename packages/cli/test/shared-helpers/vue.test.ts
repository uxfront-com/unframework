import { describe, it } from "vitest";

import { buildFixture, expectInline } from "./fixture.ts";

// Vue prints its helpers inline until its part shares them (ADR-0121).
describe("shared helper modules: Vue", () => {
	it("prints its helpers inline, in each component", async () => {
		const written = await buildFixture("vue");
		expectInline(written, ["cards/Card.vue", "badges/Badge.vue"], []);
	});
});
