import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { BaseSequencer } from "vitest/node";
import type { TestSpecification, Vitest } from "vitest/node";

import { listCases } from "./cases.ts";
import { CASES_DIR, ROOT } from "./paths.ts";
import { harnessSequencer, lastSpecs, runLast } from "./sequencer.ts";

const LEAKING = join(CASES_DIR, "sourcemaps/mounted-throws/mounted-throws.test.ts");
const spec = (area: string): string => join(CASES_DIR, `${area}/${area.split("/")[1]}.test.ts`);

/** A spec as `BaseSequencer` reads it: its project's name, group and isolation, and its file. */
function fake(project: string, moduleId: string, groupOrder: number, isolate = false) {
	return {
		project: { name: project, config: { sequence: { groupOrder }, isolate } },
		moduleId,
	};
}

/** A Vitest with no cached results or stats, so `BaseSequencer` keeps each project's order. */
const ctx = {
	config: { root: ROOT },
	cache: { getFileTestResults: () => undefined, getFileStats: () => undefined },
} as unknown as Vitest;

const names = (
	specs: ReadonlyArray<{ project: { name: string }; moduleId: string }>,
): Array<string> => specs.map((s) => `${s.project.name} ${s.moduleId.slice(CASES_DIR.length + 1)}`);

describe("the harness's sequencer (ADR-0106)", () => {
	it("runs Vue's leaking spec last in its hydrate project, and moves nothing else", () => {
		const last = new Map([["hydrate:vue", LEAKING]]);
		const sorted = runLast(
			[
				fake("hydrate:vue", spec("events/guard-controls"), 4),
				fake("hydrate:vue", LEAKING, 4),
				fake("hydrate:vue", spec("state/counter"), 4),
				fake("hydrate:vue", spec("teleport/basic"), 4),
				fake("hydrate:react", spec("state/counter"), 4),
				fake("hydrate:react", LEAKING, 4),
			],
			last,
		);
		expect(names(sorted)).toEqual([
			"hydrate:vue events/guard-controls/guard-controls.test.ts",
			"hydrate:vue state/counter/counter.test.ts",
			"hydrate:vue teleport/basic/basic.test.ts",
			"hydrate:vue sourcemaps/mounted-throws/mounted-throws.test.ts",
			"hydrate:react state/counter/counter.test.ts",
			"hydrate:react sourcemaps/mounted-throws/mounted-throws.test.ts",
		]);
	});

	it("keeps the leaking spec in place when its project runs nothing else or it is already last", () => {
		const last = new Map([["hydrate:vue", LEAKING]]);
		const alone = [fake("browser:vue", spec("state/counter"), 1), fake("hydrate:vue", LEAKING, 4)];
		expect(runLast(alone, last)).toEqual(alone);
		const already = [
			fake("hydrate:vue", spec("state/counter"), 4),
			fake("hydrate:vue", LEAKING, 4),
		];
		expect(runLast(already, last)).toEqual(already);
		expect(runLast([], last)).toEqual([]);
	});

	it("keeps BaseSequencer's order of groups, projects and every other file", async () => {
		const Sequencer = harnessSequencer(listCases());
		const files = [
			fake("hydrate:vue", spec("events/guard-controls"), 4),
			fake("browser:react", spec("state/counter"), 2),
			fake("hydrate:vue", LEAKING, 4),
			fake("browser:vue", LEAKING, 1, true),
			fake("hydrate:react", spec("state/counter"), 4),
			fake("browser:vue", spec("state/counter"), 1, true),
			fake("hydrate:vue", spec("state/counter"), 4),
			fake("browser:react", LEAKING, 2),
		] as unknown as Array<TestSpecification>;
		const base = await new BaseSequencer(ctx).sort(files);
		const sorted = await new Sequencer(ctx).sort(files);
		expect(names(base)).toEqual([
			"browser:vue sourcemaps/mounted-throws/mounted-throws.test.ts",
			"browser:vue state/counter/counter.test.ts",
			"browser:react state/counter/counter.test.ts",
			"browser:react sourcemaps/mounted-throws/mounted-throws.test.ts",
			"hydrate:react state/counter/counter.test.ts",
			"hydrate:vue events/guard-controls/guard-controls.test.ts",
			"hydrate:vue sourcemaps/mounted-throws/mounted-throws.test.ts",
			"hydrate:vue state/counter/counter.test.ts",
		]);
		// The browser projects and the other hydrate projects keep their order.
		expect(names(sorted)).toEqual([
			...names(base).slice(0, 6),
			"hydrate:vue state/counter/counter.test.ts",
			"hydrate:vue sourcemaps/mounted-throws/mounted-throws.test.ts",
		]);
	});

	it("finds each listed case's spec in the corpus, and refuses one that has none", () => {
		expect(lastSpecs(listCases())).toEqual(new Map([["hydrate:vue", LEAKING]]));
		expect(() => lastSpecs(listCases(), { vue: { case: "sourcemaps/no-such-case" } })).toThrow(
			/sourcemaps\/no-such-case for vue, which is not a case with a spec/,
		);
		expect(() =>
			lastSpecs([{ id: "diagnostics/x", spec: undefined }], { vue: { case: "diagnostics/x" } }),
		).toThrow(/diagnostics\/x/);
	});
});
