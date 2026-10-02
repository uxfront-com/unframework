// How a canary run is judged, on runs and corpora of their own: the verdict must not pass a
// canary that one case, one target or one sub-check did not catch.
import { cellOf } from "@unframework/testing/node";
import type { LayerOutcome, ParityMatrix } from "@unframework/testing/node";
import { describe, expect, it } from "vitest";

import { findCanary } from "./canaries.ts";
import { judgeCanary } from "./canary-verdict.ts";
import type { CanaryCase } from "./canary-verdict.ts";

const spec = (id: string) => `cases/${id}/${id.split("/")[1]}.test.ts`;
const hello: CanaryCase = {
  id: "basics/hello",
  hasOutput: () => true,
  spec: spec("basics/hello"),
};
const card: CanaryCase = { id: "basics/card", hasOutput: () => true, spec: spec("basics/card") };
const rejected: CanaryCase = {
  id: "diagnostics/rejected",
  hasOutput: () => false,
  spec: undefined,
};
const noSpec: CanaryCase = { id: "basics/no-spec", hasOutput: () => true, spec: undefined };

const fail = (message: string): LayerOutcome => ({ status: "fail", message });

/** The golden guard's failure of a module, as the ssr and browser projects report it. */
const guarded = (target: string) =>
  `[uf guard] The ${target} output of cases/basics/hello/Hello.uf.tsx is not its golden output:`;

/** Cells for one layer: case → target → outcome. */
function cells(
  layer: string,
  outcomes: Record<string, Record<string, LayerOutcome>>,
): ParityMatrix["cases"] {
  return Object.fromEntries(
    Object.entries(outcomes).map(([caseId, targets]) => [
      caseId,
      Object.fromEntries(
        Object.entries(targets).map(([target, outcome]) => [target, { [layer]: cellOf(outcome) }]),
      ),
    ]),
  );
}

const domDiff = (id: string) =>
  `cases/${id}/__expected__/dom.initial.html differs from this run's output:\n- a\n+ b`;
const ariaDiff = (id: string) =>
  `cases/${id}/__expected__/aria.initial.yaml differs from this run's output:\n- a\n+ b`;
const l7 = (id: string) => fail(`${domDiff(id)}\n\n${ariaDiff(id)}`);

describe("judgeCanary", () => {
  const canary = findCanary("L7-wrong-text");

  it("catches a canary that fails its layer on every case and target, in every sub-check", () => {
    const run = {
      status: 1,
      cells: cells("L7", {
        "basics/hello": { react: l7("basics/hello"), vue: l7("basics/hello") },
        "basics/card": { react: l7("basics/card"), vue: l7("basics/card") },
      }),
    };
    expect(judgeCanary(canary, run, ["react", "vue"], [hello, card, rejected])).toEqual({
      caught: true,
      problems: [],
    });
  });

  it("refuses a run that passed, or wrote no matrix", () => {
    const run = { status: 0, cells: cells("L7", { "basics/hello": { vue: l7("basics/hello") } }) };
    expect(judgeCanary(canary, run, ["vue"], [hello]).problems).toEqual(["the run passed"]);
    expect(judgeCanary(canary, { status: 1, cells: undefined }, ["vue"], [hello])).toEqual({
      caught: false,
      problems: ["the run wrote no parity matrix"],
    });
  });

  it("fails on a corrupted case where the layer passed, or recorded nothing", () => {
    const run = {
      status: 1,
      cells: cells("L7", {
        "basics/hello": { vue: l7("basics/hello") },
        "basics/card": { vue: { status: "pass" } },
      }),
    };
    expect(judgeCanary(canary, run, ["vue"], [hello, card, noSpec]).problems).toEqual([
      "vue › basics/card › L7: pass, although the canary corrupted the case",
    ]);
    expect(judgeCanary(canary, run, ["vue", "react"], [hello]).problems).toEqual([
      "react › basics/hello › L7: no result, although the canary corrupted the case",
      "react: no case could prove it in the browser projects",
    ]);
  });

  it("requires the evidence of every sub-check: a DOM failure does not prove the ARIA check", () => {
    const run = {
      status: 1,
      cells: cells("L7", { "basics/hello": { vue: fail(domDiff("basics/hello")) } }),
    };
    const { caught, problems } = judgeCanary(canary, run, ["vue"], [hello]);
    expect(caught).toBe(false);
    expect(problems).toEqual([
      expect.stringMatching(
        /^vue › basics\/hello › L7: failed, but not in the browser ARIA tree check \(.+\): cases\/basics\/hello\/__expected__\/dom\.initial\.html differs/,
      ),
    ]);
  });

  it("refuses a failure for another reason, such as a tool that did not start", () => {
    const run = {
      status: 1,
      cells: cells("L7", {
        "basics/hello": { vue: fail("browser:vue could not start: no Chromium") },
      }),
    };
    expect(judgeCanary(canary, run, ["vue"], [hello]).problems).toHaveLength(2);
  });

  it("requires each kind of project's own evidence: the server's console does not prove the page's", () => {
    const l13 = findCanary("L13-console-warn");
    const server =
      "1 console message(s) during the server render:\n  console.warn: [uf canary] L13 in vue";
    const page = "1 unexpected console message(s):\n  console.warn: [uf canary] L13 in vue";
    const caught = {
      status: 1,
      cells: cells("L13", { "basics/hello": { vue: fail(`${server}\n${page}`) } }),
    };
    expect(judgeCanary(l13, caught, ["vue"], [hello]).problems).toEqual([]);
    const serverOnly = {
      status: 1,
      cells: cells("L13", { "basics/hello": { vue: fail(server) } }),
    };
    expect(judgeCanary(l13, serverOnly, ["vue"], [hello]).problems).toEqual([
      expect.stringMatching(
        /^vue › basics\/hello › L13: failed, but not in the browser page console check/,
      ),
    ]);
    // A case without a spec has no browser half to prove.
    const noBrowser = {
      status: 1,
      cells: cells("L13", { "basics/no-spec": { vue: fail(server) } }),
    };
    expect(judgeCanary(l13, noBrowser, ["vue"], [noSpec]).problems).toEqual([
      "vue: no case could prove it in the browser projects",
    ]);
  });

  it("requires the golden evidence of the cell's own target", () => {
    const l2 = findCanary("L2-output-edited");
    const golden = (target: string) =>
      fail(`cases/basics/hello/__output__/${target}/Hello.tsx differs from this run's output:`);
    const run = {
      status: 1,
      cells: cells("L2", { "basics/hello": { react: golden("react"), solid: golden("react") } }),
    };
    expect(judgeCanary(l2, run, ["react", "solid"], [hello]).problems).toEqual([
      expect.stringMatching(
        /^solid › basics\/hello › L2: failed, but not in the compile golden output check/,
      ),
    ]);
  });

  it("spares the reference for a canary that corrupts only the followers", () => {
    const l10 = findCanary("L10-root-hidden");
    const run = {
      status: 1,
      cells: cells("L10", {
        "basics/hello": {
          vue: { status: "pass" },
          react: fail("geometry-mismatch (check+live, follower): the root is hidden"),
        },
      }),
    };
    expect(judgeCanary(l10, run, ["react", "vue"], [hello]).problems).toEqual([]);
    expect(judgeCanary(l10, run, ["vue"], [hello]).problems).toEqual([
      "the run covered no target the canary corrupts",
    ]);
  });

  it("excuses a quarantined cell, but not a target where every cell is quarantined", () => {
    const quarantined: LayerOutcome = { status: "quarantined", issue: "https://example.com/1" };
    const run = {
      status: 1,
      cells: cells("L7", {
        "basics/hello": { vue: quarantined, react: quarantined },
        "basics/card": { vue: l7("basics/card"), react: quarantined },
      }),
    };
    expect(judgeCanary(canary, run, ["react", "vue"], [hello, card]).problems).toEqual([
      "react: no case could prove it in the browser projects",
    ]);
  });
  it("judges a source canary on every case, a case with compile errors included", () => {
    const l1 = findCanary("L1-diagnostic-added");
    const differs = fail(
      'cases/x/__expected__/diagnostics.json differs from this run\'s output:\n+     "code": "UF1201",',
    );
    const caught = {
      status: 1,
      cells: cells("L1", {
        "basics/hello": { vue: differs },
        "diagnostics/rejected": { vue: differs },
      }),
    };
    expect(judgeCanary(l1, caught, ["vue"], [hello, rejected]).problems).toEqual([]);
    const missed = {
      status: 1,
      cells: cells("L1", {
        "basics/hello": { vue: differs },
        "diagnostics/rejected": { vue: { status: "pass" } },
      }),
    };
    expect(judgeCanary(l1, missed, ["vue"], [hello, rejected]).problems).toEqual([
      "vue › diagnostics/rejected › L1: pass, although the canary corrupted the case",
    ]);
    // A plugin canary cannot reach a case without output, so it is not judged there.
    const plugin = {
      status: 1,
      cells: cells("L1", {
        "basics/hello": { vue: fail("__expected__/diagnostics.json differs\nUF8001") },
        "diagnostics/rejected": { vue: { status: "pass" } },
      }),
    };
    const throws = findCanary("L1-plugin-throws");
    expect(judgeCanary(throws, plugin, ["vue"], [hello, rejected]).problems).toEqual([]);
  });

  describe("a check that fails a spec's import", () => {
    const guard = findCanary("L6-golden-guard");
    const ssr = {
      "basics/hello": { vue: fail(guarded("vue")), react: fail(guarded("react")) },
      "basics/no-spec": { vue: fail(guarded("vue")), react: fail(guarded("react")) },
    };

    it("is proven by each browser project's load error for each spec", () => {
      const run = {
        status: 1,
        cells: cells("L6", ssr),
        loadFailures: [
          { project: "browser:react", file: hello.spec!, errors: [guarded("react")] },
          { project: "browser:vue", file: hello.spec!, errors: [guarded("vue")] },
        ],
      };
      expect(judgeCanary(guard, run, ["react", "vue"], [hello, noSpec, rejected])).toEqual({
        caught: true,
        problems: [],
      });
    });

    it("fails a spec that loaded, or failed to load for another reason", () => {
      const run = {
        status: 1,
        cells: cells("L6", ssr),
        loadFailures: [
          { project: "browser:vue", file: hello.spec!, errors: ["Failed to fetch module"] },
          { project: "ssr:react", file: hello.spec!, errors: [guarded("react")] },
        ],
      };
      expect(judgeCanary(guard, run, ["react", "vue"], [hello]).problems).toEqual([
        `react › basics/hello › browser:react: ${hello.spec} loaded, although the canary corrupted the case`,
        expect.stringMatching(
          /^vue › basics\/hello › browser:vue: failed, but not in the browser golden guard check .*: Failed to fetch module$/,
        ),
      ]);
    });

    it("fails a run that wrote no list of the specs it could not load", () => {
      expect(judgeCanary(guard, { status: 1, cells: cells("L6", ssr) }, ["vue"], [hello])).toEqual({
        caught: false,
        problems: ["the run wrote no list of the specs it could not load"],
      });
    });
  });
});
