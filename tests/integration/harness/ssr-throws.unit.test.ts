import { describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import { onlyCases } from "./references.ts";
import { registersThrows } from "./ssr-throws.ts";

const plain = { id: "basics/plain", config: {} };
const throws = { id: "sourcemaps/throws", config: { ssrThrows: { props: {} } } };
const always = () => true;

describe("registersThrows (ADR-0078)", () => {
	it("registers the suite in a shard with a case that throws on purpose", () => {
		expect(registersThrows([plain, throws], [plain, throws], always)).toBe(true);
	});

	it("leaves it out of a shard without one, when another shard has it", () => {
		expect(registersThrows([plain], [plain, throws], always)).toBe(false);
	});

	it("leaves it out when the shard's case has no output on the target", () => {
		expect(registersThrows([throws], [plain, throws], (info) => info !== throws)).toBe(false);
	});

	it("leaves it out of a reference project whose cases do not throw (ADR-0057)", () => {
		const corpus = listCases();
		const only = onlyCases(corpus, ["semantics/listbox"]);
		expect(registersThrows(only, corpus, always)).toBe(false);
	});

	it("registers it empty, so Vitest fails it, when no case of the corpus throws", () => {
		expect(registersThrows([plain], [plain], always)).toBe(true);
		expect(registersThrows([], [], always)).toBe(true);
	});
});
