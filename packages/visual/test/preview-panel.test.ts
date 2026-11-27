// The controls panel's segment rule (UXF-1140), in Node: `controlKit()` touches no DOM until a
// builder runs. An optional boolean or a union is a row of segments when its choices, "Default"
// counted, are at most 4 and add up to at most 24 characters.
import { describe, expect, it } from "vitest";

import type { PropControl } from "../src/preview/controls.ts";
import { controlKit } from "../src/preview/panel.ts";

const { segmented } = controlKit();

const union = (options: Array<string>, optional = true): PropControl => ({
	name: "choice",
	optional,
	kind: "select",
	options,
	initial: options[0]!,
});

describe("segmented", () => {
	it("takes an optional boolean, and leaves a required one a checkbox", () => {
		expect(segmented({ name: "on", optional: true, kind: "boolean", initial: false })).toBe(true);
		expect(segmented({ name: "on", optional: false, kind: "boolean", initial: false })).toBe(false);
	});

	it("takes a union of at most 4 choices, Default counted", () => {
		expect(segmented(union(["sm", "md", "lg"]))).toBe(true);
		expect(segmented(union(["xs", "sm", "md", "lg"]))).toBe(false);
		// A required union has no Default.
		expect(segmented(union(["xs", "sm", "md", "lg"], false))).toBe(true);
	});

	it("takes choices of at most 24 characters together", () => {
		// "Default" + "primary" + "secondary": 23.
		expect(segmented(union(["primary", "secondary"]))).toBe(true);
		// "Default" + "primary" + "secondaries": 25.
		expect(segmented(union(["primary", "secondaries"]))).toBe(false);
		// 24 without a Default.
		expect(segmented(union(["abcdefgh", "ijklmnop", "qrstuvwx"], false))).toBe(true);
	});

	it("never takes a string or a number", () => {
		expect(segmented({ name: "label", optional: true, kind: "string", initial: "" })).toBe(false);
		expect(segmented({ name: "size", optional: true, kind: "number", initial: 0 })).toBe(false);
	});
});
