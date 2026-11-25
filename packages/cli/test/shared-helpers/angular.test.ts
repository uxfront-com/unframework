import { describe, expect, it } from "vitest";

import { buildFixture, declares } from "./fixture.ts";

// Angular shares its helpers (ADR-0121): each is one module at the root of the tree. Its
// `Transition` and `TransitionRegion` stay inline, since a shared region would be found across
// component hosts (R2).
describe("shared helper modules: Angular", () => {
	it("writes each helper once in _unframework/, and every component imports it", async () => {
		const written = await buildFixture("angular");
		expect(Object.keys(written).filter((path) => path.startsWith("_unframework/"))).toEqual([
			"_unframework/ScopeAttributes.ts",
			"_unframework/queueHook.ts",
		]);
		// None below the root: one directory serves the whole tree.
		expect(Object.keys(written).filter((path) => path.includes("/_unframework/"))).toEqual([]);
		for (const component of ["cards/card.ts", "badges/badge.ts"]) {
			const contents = written[component]!;
			expect(contents, `${component} imports ScopeAttributes`).toContain(
				'import { ScopeAttributes } from "../_unframework/ScopeAttributes";',
			);
			expect(contents).toMatch(/imports: \[[^\]]*\bScopeAttributes\b/);
			for (const name of ["ScopeAttributes", "scopes", "queueHook"]) {
				expect(declares(contents, name), `${component} declares ${name}`).toBe(false);
			}
			for (const name of ["Transition", "TransitionRegion"]) {
				expect(declares(contents, name), `${component} declares ${name}`).toBe(true);
			}
		}
		const mark = written["v-mark.ts"]!;
		expect(mark).toContain('import { queueHook } from "./_unframework/queueHook";');
		expect(declares(mark, "queueHook")).toBe(false);
		// The runner stays inline (R2).
		expect(declares(mark, "runDirective")).toBe(true);
		// A helper module imports only its framework and its siblings.
		for (const [path, contents] of Object.entries(written)) {
			if (!path.startsWith("_unframework/")) {
				continue;
			}
			for (const [, specifier] of contents.matchAll(/from "([^"]+)"/g)) {
				expect(specifier, path).toMatch(/^(?:@angular\/[\w-]+|\.\/\w+)$/);
			}
		}
	});
});
