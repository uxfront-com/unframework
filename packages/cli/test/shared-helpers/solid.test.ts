import { describe, expect, it } from "vitest";

import { buildFixture, declares } from "./fixture.ts";

// Solid shares its helpers (ADR-0121): each is one module at the root of the tree, which every
// component and directive module imports.
describe("shared helper modules: Solid", () => {
	it("writes each helper once in _unframework/, and every component imports it", async () => {
		const written = await buildFixture("solid");
		expect(Object.keys(written).filter((path) => path.startsWith("_unframework/"))).toEqual([
			"_unframework/Transition.tsx",
			"_unframework/cx.ts",
			"_unframework/queueHook.ts",
			"_unframework/scopeAttributes.ts",
		]);
		// None below the root: one directory serves the whole tree.
		expect(Object.keys(written).filter((path) => path.includes("/_unframework/"))).toEqual([]);
		for (const component of ["cards/Card.tsx", "badges/Badge.tsx"]) {
			const contents = written[component]!;
			for (const name of ["cx", "scopeAttributes", "Transition"]) {
				expect(contents, `${component} imports ${name}`).toContain(
					`import { ${name} } from "../_unframework/${name}";`,
				);
				expect(declares(contents, name), `${component} declares ${name}`).toBe(false);
			}
		}
		const mark = written["vMark.ts"]!;
		expect(mark).toContain('import { queueHook } from "./_unframework/queueHook";');
		expect(declares(mark, "queueHook")).toBe(false);
		// A helper module imports only its framework, and nothing else of ours (A2).
		for (const [path, contents] of Object.entries(written)) {
			if (!path.startsWith("_unframework/")) {
				continue;
			}
			for (const [, specifier] of contents.matchAll(/from "([^"]+)"/g)) {
				expect(specifier, path).toMatch(/^(?:solid-js|solid-js\/web)$/);
			}
		}
	});
});
