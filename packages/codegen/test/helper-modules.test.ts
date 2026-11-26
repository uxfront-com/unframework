import { describe, expect, it } from "vitest";

import { createHelperModules, HELPER_DIRECTORY } from "../src/index.ts";

describe("createHelperModules (ADR-0121)", () => {
	it("gives each output the relative path of a helper in _unframework/, and lists it once", () => {
		const modules = createHelperModules();
		expect(HELPER_DIRECTORY).toBe("_unframework");
		expect(modules.helper("cx.ts", "a", "Card.tsx")).toBe("./_unframework/cx.ts");
		expect(modules.helper("cx.ts", "a", "Badge.tsx")).toBe("./_unframework/cx.ts");
		expect(modules.helper("Transition.tsx", "b", "Card.tsx")).toBe("./_unframework/Transition.tsx");
		expect(modules.files()).toEqual([
			{ path: "_unframework/Transition.tsx", contents: "b" },
			{ path: "_unframework/cx.ts", contents: "a" },
		]);
	});

	it("puts the helpers in a directory above the outputs' own", () => {
		const modules = createHelperModules("../..");
		expect(modules.helper("cx.ts", "a", "Card.tsx")).toBe("../../_unframework/cx.ts");
		expect(modules.files().map(({ path }) => path)).toEqual(["../../_unframework/cx.ts"]);
		expect(createHelperModules("./").helper("cx.ts", "a", "Card.tsx")).toBe("./_unframework/cx.ts");
	});

	it("names a helper from a nested output", () => {
		expect(createHelperModules().helper("cx.ts", "a", "parts/Icon.tsx")).toBe(
			"../_unframework/cx.ts",
		);
		expect(createHelperModules("..").helper("cx.ts", "a", "parts/Icon.tsx")).toBe(
			"../../_unframework/cx.ts",
		);
	});

	it("throws on one file given two texts, which is a target's bug", () => {
		const modules = createHelperModules();
		modules.helper("cx.ts", "a", "Card.tsx");
		expect(() => modules.helper("cx.ts", "b", "Badge.tsx")).toThrow(
			"The helper module _unframework/cx.ts was given two different texts",
		);
	});

	it.each([
		"",
		"cx",
		"../cx.ts",
		"a/../../cx.ts",
		"/cx.ts",
		"c x.ts",
		String.raw`a\\cx.ts`,
		"a/cx.ts",
		".ts",
	])("throws on a file name that leaves _unframework/ or isn't a module's: %j", (file) => {
		expect(() => createHelperModules().helper(file, "a", "Card.tsx")).toThrow(TypeError);
	});

	it.each(["src", "../src", "/abs"])("throws on a base that isn't a parent: %j", (base) => {
		expect(() => createHelperModules(base)).toThrow(TypeError);
	});
});
