import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { importsOf, sourceFiles } from "./workspace.ts";

const project = mkdtempSync(join(tmpdir(), "uf-source-files-"));
afterAll(() => rmSync(project, { recursive: true, force: true }));

function write(path: string): void {
	mkdirSync(join(project, path, ".."), { recursive: true });
	writeFileSync(join(project, path), "export {};\n");
}

describe("sourceFiles", () => {
	it("skips dot directories, node_modules and dist, like the canaries' scratch", () => {
		for (const path of [
			"a.ts",
			"nested/b.tsx",
			"nested/c.mts",
			"nested/types.d.ts",
			"nested/readme.md",
			".canary/vue/state/counter/probe.test.ts",
			"nested/.vitest/cache.ts",
			"node_modules/pkg/index.ts",
			"nested/dist/index.ts",
		]) {
			write(path);
		}
		expect(sourceFiles(project).map((file) => relative(project, file))).toEqual([
			"a.ts",
			join("nested", "b.tsx"),
			join("nested", "c.mts"),
		]);
	});

	it("walks the directory it is given, even a dot directory", () => {
		expect(sourceFiles(join(project, ".canary")).map((file) => relative(project, file))).toEqual([
			join(".canary", "vue", "state", "counter", "probe.test.ts"),
		]);
	});

	it("returns nothing for a directory that doesn't exist", () => {
		expect(sourceFiles(join(project, "missing"))).toEqual([]);
	});
});

describe("importsOf", () => {
	// The layering test reads `typeOnly` to tell a runtime import of `typescript` from a type-only
	// one, so each form is pinned here, the ones oxc-parser lists with no entry included.
	const forms: [source: string, typeOnly: boolean][] = [
		['import type { A } from "typescript";', true],
		['import type A from "typescript";', true],
		['import type * as ts from "typescript";', true],
		['import type {} from "typescript";', true],
		['import { type A, B } from "typescript";', false],
		['import * as ts from "typescript";', false],
		['import ts from "typescript";', false],
		['import "typescript";', false],
		['import {} from "typescript";', false],
		['export type { A } from "typescript";', true],
		['export { A } from "typescript";', false],
		['export * from "typescript";', false],
		['await import("typescript");', false],
	];

	it.each(forms)("reads %s as typeOnly %s", (source, typeOnly) => {
		const path = join(mkdtempSync(join(project, "form-")), "form.ts");
		writeFileSync(path, `${source}\n`);
		expect(importsOf(path).map((record) => [record.specifier, record.typeOnly])).toEqual([
			["typescript", typeOnly],
		]);
	});

	it("reads each import of a file, whichever comes first", () => {
		const path = join(mkdtempSync(join(project, "mixed-")), "mixed.ts");
		writeFileSync(
			path,
			[
				'import type {} from "typescript";',
				'import { a } from "./a.ts";',
				'import type {} from "./b.ts";',
				'import "./c.ts";',
				"",
			].join("\n"),
		);
		expect(importsOf(path).map((record) => [record.specifier, record.typeOnly])).toEqual([
			["typescript", true],
			["./a.ts", false],
			["./b.ts", true],
			["./c.ts", false],
		]);
	});
});
