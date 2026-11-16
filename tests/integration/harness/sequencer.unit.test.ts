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

const names = (specs: readonly { project: { name: string }; moduleId: string }[]): string[] =>
  specs.map((s) => `${s.project.name} ${s.moduleId.slice(CASES_DIR.length + 1)}`);

describe("the harness's sequencer (ADR-0106)", () => {
  it("runs Vue's leaking spec last in its hydrate project, and moves nothing else", () => {
    const last = new Map([["hydrate:vue", [LEAKING]]]);
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
    const last = new Map([["hydrate:vue", [LEAKING]]]);
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
    ] as unknown as TestSpecification[];
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
    expect(lastSpecs(listCases(), undefined, {})).toEqual(new Map([["hydrate:vue", [LEAKING]]]));
    expect(() => lastSpecs(listCases(), { vue: { case: "sourcemaps/no-such-case" } }, {})).toThrow(
      /sourcemaps\/no-such-case for vue, which is not a case with a spec/,
    );
    expect(() =>
      lastSpecs([{ id: "diagnostics/x", spec: undefined }], { vue: { case: "diagnostics/x" } }, {}),
    ).toThrow(/diagnostics\/x/);
  });
});

describe("the areas that change a target's page (ADR-0101)", () => {
  const ASYNC = ["async-setup/nested", "async-setup/resolved"].map(spec);

  it("runs Svelte's async-setup specs last in its browser and hydrate projects", () => {
    const last = new Map([
      ["browser:svelte", ASYNC],
      ["hydrate:svelte", ASYNC],
    ]);
    const sorted = runLast(
      [
        fake("browser:svelte", ASYNC[1]!, 2),
        fake("browser:svelte", spec("state/counter"), 2),
        fake("browser:svelte", ASYNC[0]!, 2),
        fake("browser:svelte", spec("teleport/basic"), 2),
        fake("browser:react", ASYNC[0]!, 2),
        fake("browser:react", spec("state/counter"), 2),
        fake("hydrate:svelte", ASYNC[0]!, 4),
        fake("hydrate:svelte", spec("state/counter"), 4),
      ],
      last,
    );
    expect(names(sorted)).toEqual([
      "browser:svelte state/counter/counter.test.ts",
      "browser:svelte teleport/basic/basic.test.ts",
      "browser:svelte async-setup/nested/nested.test.ts",
      "browser:svelte async-setup/resolved/resolved.test.ts",
      "browser:react async-setup/nested/nested.test.ts",
      "browser:react state/counter/counter.test.ts",
      "hydrate:svelte state/counter/counter.test.ts",
      "hydrate:svelte async-setup/nested/nested.test.ts",
    ]);
  });

  it("runs a target's unusable spec after the page-changing ones", () => {
    const last = lastSpecs(
      [
        { id: "async-setup/resolved", spec: ASYNC[1] },
        { id: "sourcemaps/mounted-throws", spec: LEAKING },
      ],
      { vue: { case: "sourcemaps/mounted-throws" } },
      { vue: { area: "async-setup" } },
    );
    expect(last).toEqual(
      new Map([
        ["browser:vue", [ASYNC[1]]],
        ["hydrate:vue", [ASYNC[1], LEAKING]],
      ]),
    );
    const sorted = runLast(
      [
        fake("hydrate:vue", LEAKING, 4),
        fake("hydrate:vue", ASYNC[1]!, 4),
        fake("hydrate:vue", spec("state/counter"), 4),
      ],
      last,
    );
    expect(names(sorted)).toEqual([
      "hydrate:vue state/counter/counter.test.ts",
      "hydrate:vue async-setup/resolved/resolved.test.ts",
      "hydrate:vue sourcemaps/mounted-throws/mounted-throws.test.ts",
    ]);
  });

  it("lists every async-setup spec of the corpus for Svelte, and refuses an area with none", () => {
    const last = lastSpecs(listCases());
    const specs = listCases()
      .filter((info) => info.id.startsWith("async-setup/") && info.spec)
      .map((info) => info.spec!);
    expect(specs.length).toBeGreaterThanOrEqual(5);
    expect(last.get("browser:svelte")).toEqual([...specs].sort());
    expect(last.get("hydrate:svelte")).toEqual([...specs].sort());
    expect(last.get("hydrate:vue")).toEqual([LEAKING]);
    expect(() => lastSpecs(listCases(), {}, { svelte: { area: "no-such-area" } })).toThrow(
      /no-such-area for svelte, which holds no case with a spec/,
    );
  });
});
