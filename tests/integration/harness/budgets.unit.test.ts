// How L15 judges a cell, and what it measures: the margins at their edges, a bundle's externals,
// and every target's production compile of a component, a case of several sources and a styled one.
import { cpSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { TARGET_NAMES } from "@unframework/compiler";
import type { TargetName } from "@unframework/compiler";
import { describe, expect, it } from "vitest";

import {
  budgetedCases,
  budgetProblems,
  bundleSize,
  CALIBRATION,
  measureSize,
  measureTimes,
  readBudgets,
  staleBudgets,
} from "../scripts/budgets.ts";
import type { CaseCost } from "../scripts/budgets.ts";
import { errorState, listCases } from "./cases.ts";
import { ENGINE_DECLARATIONS } from "./engines.ts";
import { committedOutputFiles } from "./output-files.ts";
import { CANARY_DIR, CASES_DIR, ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain } from "./targets.ts";

const budget: CaseCost = { time: 2, sizes: { vue: { raw: 1000, gzip: 500 } } };
const size = { raw: 1000, gzip: 500 };

describe("budgetProblems", () => {
  it("passes a cell on its margins", () => {
    expect(budgetProblems(budget, "vue", 4, { raw: 1050, gzip: 525 })).toEqual([]);
  });

  it("fails a time above twice its budget", () => {
    expect(budgetProblems(budget, "vue", 4.01, size)).toEqual([
      expect.stringMatching(/^compile time 4\.01 × basics\/hello is above 2 × its budget of 2\./),
    ]);
  });

  it("fails each size above its budget plus 5%", () => {
    expect(budgetProblems(budget, "vue", 1, { raw: 1051, gzip: 500 })).toEqual([
      expect.stringMatching(/^raw size 1051 B is above its budget of 1000 B plus 5%\./),
    ]);
    expect(budgetProblems(budget, "vue", 1, { raw: 1000, gzip: 526 })).toEqual([
      expect.stringMatching(/^gzip size 526 B is above its budget of 500 B plus 5%\./),
    ]);
  });

  it("names everything over budget in one failure", () => {
    expect(budgetProblems(budget, "vue", 5, { raw: 2000, gzip: 2000 })).toHaveLength(3);
  });

  it("fails a case or a target with no budget, with what to run", () => {
    const missing = ["No budget for this cell. Run `pnpm test:budgets:update`."];
    expect(budgetProblems(undefined, "vue", 1, size)).toEqual(missing);
    expect(budgetProblems(budget, "react", 1, size)).toEqual(missing);
  });
});

describe("readBudgets", () => {
  it("says what to run when the file cannot be read", () => {
    expect(() => readBudgets(`${ROOT}/no-budgets.json`)).toThrow(
      /no-budgets\.json cannot be read\. Run `pnpm test:budgets:update`/,
    );
  });
});

describe("budgetedCases", () => {
  it("holds the calibration case, and no case with output on no target", () => {
    const corpus = listCases();
    const ids = budgetedCases(corpus).map((info) => info.id);
    expect(ids).toContain(CALIBRATION);
    expect(ids).toContain("state/counter");
    expect(ids).not.toContain("diagnostics/ambiguous-jsx-text");
  });
});

describe("bundleSize", () => {
  const module = (path: string, contents: string) => ({ path, contents });

  it("minifies, and leaves the framework, a stylesheet and a passThrough import external", async () => {
    const spaced = 'import "vue";\nimport "./a.css?inline";\nimport "virtual:engine";\n';
    const small = await bundleSize([[module("/case/a.ts", spaced)]]);
    const large = await bundleSize([
      [module("/case/a.ts", `${spaced}console.log("${"x".repeat(100)}");`)],
    ]);
    expect(small.raw).toBeGreaterThan(0);
    expect(small.raw).toBeLessThanOrEqual(spaced.length);
    expect(large.raw).toBeGreaterThanOrEqual(small.raw + 100);
    expect(large.gzip).toBeLessThan(large.raw);
  });

  it("resolves a relative import by any script extension, and counts it once", async () => {
    const child = 'export const child = () => console.log("child");';
    const lone = await bundleSize([[module("/case/child.ts", child)]]);
    const both = await bundleSize([
      [module("/case/parent.tsx", 'import { child } from "./child.js"; child();')],
      [module("/case/child.ts", child)],
    ]);
    expect(both.raw).toBeGreaterThan(lone.raw);
    expect(both.raw).toBeLessThan(lone.raw * 3);
  });

  it("counts a module a list splits off, once the first imports it", async () => {
    const split = `export const lazy = () => console.log("${"x".repeat(200)}");`;
    const lazy = await bundleSize([
      [
        module("/case/a.js", 'import("./a_lazy.js").then((m) => m.lazy());'),
        module("/case/a_lazy.js", split),
      ],
    ]);
    expect(lazy.raw).toBeGreaterThan(200 + 'import("./a_lazy.js")'.length);
  });

  it("rejects a relative import no module provides", async () => {
    await expect(bundleSize([[module("/case/a.ts", 'import "./gone.ts";')]])).rejects.toThrow(
      /imports \.\/gone\.ts, which no module of the case provides/,
    );
  });

  it("drops what a production build drops", async () => {
    const guarded = await bundleSize([
      [module("/case/a.js", `if (ngDevMode) console.log("${"x".repeat(100)}");`)],
    ]);
    const node = await bundleSize([
      [
        module(
          "/case/a.js",
          `if (process.env.NODE_ENV !== "production") console.log("${"x".repeat(100)}");`,
        ),
      ],
    ]);
    expect(guarded.raw).toBeLessThan(50);
    expect(node.raw).toBeLessThan(50);
  });
});

describe("measureSize", () => {
  it("says a cell has no output to measure, rather than measuring nothing", async () => {
    const toolchain = await loadToolchain("vue");
    await expect(measureSize(toolchain, "vue", [])).rejects.toThrow(
      /no vue output to measure\. Run `pnpm test:update`/,
    );
  });
});

describe("staleBudgets", () => {
  it("names a case the corpus has left, and a target that lost its output", () => {
    const corpus = budgetedCases(listCases());
    const fresh = { cases: { [CALIBRATION]: { time: 1, sizes: { vue: size } } } };
    expect(staleBudgets(fresh, corpus)).toEqual([]);
    expect(staleBudgets({ cases: { "gone/case": { time: 1, sizes: {} } } }, corpus)).toEqual([
      "gone/case",
    ]);
    const lost = corpus.find((info) =>
      TARGET_NAMES.some((target) => errorState(info, target) === true),
    )!;
    const target = TARGET_NAMES.find((name) => errorState(lost, name) === true)!;
    expect(
      staleBudgets({ cases: { [lost.id]: { time: 1, sizes: { [target]: size } } } }, corpus),
    ).toEqual([`${lost.id} › ${target}`]);
  });
});

describe("measureTimes", () => {
  const corpus = listCases();
  const pick = (id: string) => corpus.find((info) => info.id === id)!;

  it("gives a ratio of the calibration case, whose own is 1", async () => {
    const times = await measureTimes([pick(CALIBRATION), pick("state/counter")], CASES_DIR);
    expect(times.get(CALIBRATION)).toBe(1);
    expect(times.get("state/counter")).toBeGreaterThan(1);
  }, 120_000);

  it("refuses a corpus without the calibration case", async () => {
    await expect(measureTimes([pick("state/counter")], CASES_DIR)).rejects.toThrow(
      /no basics\/hello/,
    );
  });
});

describe("each toolchain's frameworkEmit", () => {
  const corpus = listCases();
  const pick = (id: string) => corpus.find((info) => info.id === id)!;

  it.each(TARGET_NAMES)(
    "%s compiles a component, a parent and its child, a composable and a styled component",
    async (target) => {
      const toolchain = await loadToolchain(target);
      const sizes: Record<string, number> = {};
      for (const id of [CALIBRATION, "slots/default", "composables/use-toggle", "styles/deep"]) {
        const files = committedOutputFiles(pick(id), target);
        expect(files.length, id).toBeGreaterThan(0);
        sizes[id] = (await measureSize(toolchain, target, files)).raw;
        expect(sizes[id], id).toBeGreaterThan(0);
      }
      // More source compiles to more code, so the compile did not drop what it was given.
      expect(sizes["slots/default"]).toBeGreaterThan(sizes[CALIBRATION]!);
    },
    120_000,
  );

  /** What a target's toolchain emits for a case's files, by each file's path. */
  async function emit(target: TargetName, id: string) {
    const toolchain = await loadToolchain(target);
    const files = committedOutputFiles(pick(id), target).map((path) => ({
      path,
      contents: readFileSync(path, "utf8"),
    }));
    return toolchain.frameworkEmit(files, {
      toolchainDir: toolchainDir(target),
      root: ROOT,
      declarations: ENGINE_DECLARATIONS,
    });
  }

  it.each(TARGET_NAMES)("%s measures the same wherever the files live", async (target) => {
    const info = pick("styles/deep");
    const copy = join(CANARY_DIR, "budgets-unit", "a-directory-the-goldens-are-not-in", target);
    rmSync(copy, { recursive: true, force: true });
    cpSync(join(info.dir, "__output__", target), copy, { recursive: true });
    try {
      const toolchain = await loadToolchain(target);
      const files = committedOutputFiles(info, target);
      const moved = files.map((file) => join(copy, relative(dirname(files[0]!), file)));
      expect(await measureSize(toolchain, target, moved)).toEqual(
        await measureSize(toolchain, target, files),
      );
    } finally {
      rmSync(join(CANARY_DIR, "budgets-unit", "a-directory-the-goldens-are-not-in", target), {
        recursive: true,
        force: true,
      });
    }
  });

  it("vue imports a component's sheet, as plugin-vue does for a `src`", async () => {
    const [module] = [...(await emit("vue", "styles/deep")).values()].flat();
    expect(module!.contents).toMatch(/^import "\.\/\S+\.css";/m);
  });

  it("qwik puts a file's own module before its segments, beside it", async () => {
    const [main, ...segments] = [...(await emit("qwik", "state/counter")).values()].flat();
    expect(segments.length).toBeGreaterThan(0);
    expect(main!.contents).toMatch(/import\(/);
    for (const { path } of [main!, ...segments]) expect(dirname(path)).toContain("__output__");
  });

  it("angular leaves out what only JIT and TestBed read", async () => {
    const [module] = [...(await emit("angular", "state/counter")).values()].flat();
    expect(module!.contents).toContain("ɵɵdefineComponent");
    expect(module!.contents).not.toContain("setClassMetadata");
  });
});
