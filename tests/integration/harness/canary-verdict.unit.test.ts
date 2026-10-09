// How a canary run is judged, on runs and corpora of their own: the verdict must not pass a
// canary that one case, one target, one kind of project or one sub-check did not catch, and
// must not demand evidence from tests a target skipped by capability.
import { TARGET_NAMES } from "@unframework/compiler";
import { cellOf } from "@unframework/testing/node";
import type { LayerOutcome, PartialMatrix, ProjectKind } from "@unframework/testing/node";
import { describe, expect, it } from "vitest";

import { findCanary } from "./canaries.ts";
import type { CanaryCase } from "./canaries.ts";
import { judgeCanary, projectOf } from "./canary-verdict.ts";

const spec = (id: string) => `cases/${id}/${id.split("/")[1]}.test.ts`;
/** What the L9 canaries read of a case: a static one, whose tests run everywhere, never act and never rerender. */
const still = {
  runs: () => true,
  interacts: () => false,
  rerenders: () => false,
  listens: false,
  reference: "vue",
};
const hello: CanaryCase = {
  id: "basics/hello",
  hasOutput: () => true,
  spec: spec("basics/hello"),
  hasFixes: () => false,
  ...still,
};
const card: CanaryCase = {
  id: "basics/card",
  hasOutput: () => true,
  spec: spec("basics/card"),
  hasFixes: () => false,
  ...still,
};
const rejected: CanaryCase = {
  id: "diagnostics/rejected",
  hasOutput: () => false,
  spec: undefined,
  hasFixes: () => false,
  ...still,
};
const noSpec: CanaryCase = {
  id: "basics/no-spec",
  hasOutput: () => true,
  spec: undefined,
  hasFixes: () => false,
  ...still,
};

/** Whether a target runs client code: every target but Astro (its `interactivity` cell). */
const interactive = (target: string) => target !== "astro";

const fail = (message: string): LayerOutcome => ({ status: "fail", message });
const pass: LayerOutcome = { status: "pass" };
/** What a browser project records on Astro for a test that requires interactivity. */
const astroSkip: LayerOutcome = {
  status: "skip",
  reason: "requires interactivity: Astro components render on the server only",
};
const noInteraction: LayerOutcome = { status: "skip", reason: "no scripted interaction" };

/** The golden guard's failure of a module, as the ssr and browser projects report it. */
const guarded = (target: string) =>
  `[uf guard] The ${target} output of cases/basics/hello/Hello.uf.tsx is not its golden output:`;

type Projects = NonNullable<PartialMatrix["byProject"]>;

/**
 * One kind of project's cells for one layer (case → target → outcome), as the run's
 * `byProject` keeps them: each target's under its own project (`browser:react`), the compile
 * project's under `compile`.
 */
function cells(
  layer: string,
  outcomes: Record<string, Record<string, LayerOutcome>>,
  kind: ProjectKind = "browser",
): Projects {
  const projects: Projects = {};
  for (const [caseId, targets] of Object.entries(outcomes)) {
    for (const [target, outcome] of Object.entries(targets)) {
      ((projects[projectOf(kind, target)] ??= {})[caseId] ??= {})[target] = {
        [layer]: cellOf(outcome),
      };
    }
  }
  return projects;
}

/** Several kinds' cells, as one run's `byProject`. */
function merged(...sets: readonly Projects[]): Projects {
  const projects: Projects = {};
  for (const set of sets) {
    for (const [project, byCase] of Object.entries(set)) {
      for (const [caseId, targets] of Object.entries(byCase)) {
        for (const [target, layers] of Object.entries(targets)) {
          Object.assign((((projects[project] ??= {})[caseId] ??= {})[target] ??= {}), layers);
        }
      }
    }
  }
  return projects;
}

/** Every target's outcome, by a function of the target. */
const everyTarget = (outcome: (target: string) => LayerOutcome) =>
  Object.fromEntries(TARGET_NAMES.map((target) => [target, outcome(target)]));

const domDiff = (id: string) =>
  `cases/${id}/__expected__/dom.initial.html differs from this run's output:\n- a\n+ b`;
const ariaDiff = (id: string) =>
  `cases/${id}/__expected__/aria.initial.yaml differs from this run's output:\n- a\n+ b`;
const l7 = (id: string) => fail(`${domDiff(id)}\n\n${ariaDiff(id)}`);
const traceDiff = (id: string) =>
  fail(`cases/${id}/__expected__/trace.after-click.json differs from this run's output:\n- a\n+ b`);

const serverWarning = (target: string) =>
  fail(
    `1 console message(s) during the server render:\n  console.warn: [uf canary] L13 in ${target}`,
  );
const pageWarning = (target: string) =>
  fail(`1 unexpected console message(s):\n  console.warn: [uf canary] L13 in ${target}`);

describe("judgeCanary", () => {
  const canary = findCanary("L7-wrong-text");

  it("catches a canary that fails its layer on every case and target, in every sub-check", () => {
    const run = {
      status: 1,
      projects: cells("L7", {
        "basics/hello": { react: l7("basics/hello"), vue: l7("basics/hello") },
        "basics/card": { react: l7("basics/card"), vue: l7("basics/card") },
      }),
    };
    expect(judgeCanary(canary, run, ["react", "vue"], [hello, card, rejected])).toEqual({
      caught: true,
      problems: [],
      notes: [],
    });
  });

  it("refuses a run that passed, or wrote no matrix", () => {
    const run = {
      status: 0,
      projects: cells("L7", { "basics/hello": { vue: l7("basics/hello") } }),
    };
    expect(judgeCanary(canary, run, ["vue"], [hello]).problems).toEqual(["the run passed"]);
    expect(judgeCanary(canary, { status: 1, projects: undefined }, ["vue"], [hello])).toEqual({
      caught: false,
      problems: ["the run wrote no parity matrix"],
      notes: [],
    });
  });

  it("fails on a corrupted case where the layer passed, or recorded nothing", () => {
    const run = {
      status: 1,
      projects: cells("L7", {
        "basics/hello": { vue: l7("basics/hello") },
        "basics/card": { vue: pass },
      }),
    };
    expect(judgeCanary(canary, run, ["vue"], [hello, card, noSpec]).problems).toEqual([
      "vue › basics/card › L7 (browser:vue): pass, although the canary corrupted the case",
    ]);
    expect(judgeCanary(canary, run, ["vue", "react"], [hello]).problems).toEqual([
      "react › basics/hello › L7 (browser:react): no result, although the canary corrupted the case",
      "react: no case could prove it in the browser projects",
    ]);
  });

  it("requires the evidence of every sub-check: a DOM failure does not prove the ARIA check", () => {
    const run = {
      status: 1,
      projects: cells("L7", { "basics/hello": { vue: fail(domDiff("basics/hello")) } }),
    };
    const { caught, problems } = judgeCanary(canary, run, ["vue"], [hello]);
    expect(caught).toBe(false);
    expect(problems).toEqual([
      expect.stringMatching(
        /^vue › basics\/hello › L7 \(browser:vue\): failed, but not in the browser ARIA tree check \(.+\): cases\/basics\/hello\/__expected__\/dom\.initial\.html differs/,
      ),
    ]);
  });

  it("refuses a failure for another reason, such as a tool that did not start", () => {
    const run = {
      status: 1,
      projects: cells("L7", {
        "basics/hello": { vue: fail("browser:vue could not start: no Chromium") },
      }),
    };
    expect(judgeCanary(canary, run, ["vue"], [hello]).problems).toHaveLength(2);
  });

  it("requires each kind of project's own evidence, in its own cells", () => {
    const l13 = findCanary("L13-console-warn");
    const caught = {
      status: 1,
      projects: merged(
        cells("L13", { "basics/hello": { vue: serverWarning("vue") } }, "ssr"),
        cells("L13", { "basics/hello": { vue: pageWarning("vue") } }),
      ),
    };
    expect(judgeCanary(l13, caught, ["vue"], [hello]).problems).toEqual([]);
    // The server's console does not prove the page's: the browser project passed.
    const serverOnly = {
      status: 1,
      projects: merged(
        cells("L13", { "basics/hello": { vue: serverWarning("vue") } }, "ssr"),
        cells("L13", { "basics/hello": { vue: pass } }),
      ),
    };
    expect(judgeCanary(l13, serverOnly, ["vue"], [hello]).problems).toEqual([
      "vue › basics/hello › L13 (browser:vue): pass, although the canary corrupted the case",
    ]);
    // Nor does the page's message, found in another project's cell, prove the server's.
    const misplaced = {
      status: 1,
      projects: merged(
        cells("L13", { "basics/hello": { vue: pageWarning("vue") } }, "ssr"),
        cells("L13", { "basics/hello": { vue: pageWarning("vue") } }),
      ),
    };
    expect(judgeCanary(l13, misplaced, ["vue"], [hello]).problems).toEqual([
      expect.stringMatching(
        /^vue › basics\/hello › L13 \(ssr:vue\): failed, but not in the ssr server render console check/,
      ),
    ]);
    // A case without a spec has no browser half to prove.
    const noBrowser = {
      status: 1,
      projects: cells("L13", { "basics/no-spec": { vue: serverWarning("vue") } }, "ssr"),
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
      projects: cells(
        "L2",
        { "basics/hello": { react: golden("react"), solid: golden("react") } },
        "compile",
      ),
    };
    expect(judgeCanary(l2, run, ["react", "solid"], [hello]).problems).toEqual([
      expect.stringMatching(
        /^solid › basics\/hello › L2 \(compile\): failed, but not in the compile golden output check/,
      ),
    ]);
  });

  it("spares the reference for a canary that corrupts only the followers", () => {
    const l10 = findCanary("L10-root-hidden");
    const run = {
      status: 1,
      projects: cells("L10", {
        "basics/hello": {
          vue: pass,
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
      projects: cells("L7", {
        "basics/hello": { vue: quarantined, react: quarantined },
        "basics/card": { vue: l7("basics/card"), react: quarantined },
      }),
    };
    expect(judgeCanary(canary, run, ["react", "vue"], [hello, card]).problems).toEqual([
      "react: no case could prove it in the browser projects",
    ]);
  });

  it("excuses a cell its target skipped by capability, as it does a quarantined one", () => {
    const run = {
      status: 1,
      projects: cells("L7", {
        "basics/hello": { vue: l7("basics/hello"), astro: astroSkip },
        "basics/card": { vue: l7("basics/card"), astro: l7("basics/card") },
      }),
    };
    expect(judgeCanary(canary, run, ["astro", "vue"], [hello, card]).problems).toEqual([]);
    // Any other skip is a case the canary corrupted and nothing caught.
    const other = {
      status: 1,
      projects: cells("L7", {
        "basics/hello": { vue: l7("basics/hello"), astro: { status: "skip", reason: "later" } },
      }),
    };
    expect(judgeCanary(canary, other, ["astro", "vue"], [hello]).problems).toEqual([
      "astro › basics/hello › L7 (browser:astro): skip(later), although the canary corrupted the case",
    ]);
  });

  it("judges L9-unwired-handler on the followers' cases that act and listen", () => {
    const unwired = findCanary("L9-unwired-handler");
    const counter: CanaryCase = {
      ...hello,
      id: "state/counter",
      spec: spec("state/counter"),
      interacts: interactive,
      listens: true,
    };
    const run = {
      status: 1,
      projects: cells("L9", {
        "state/counter": { react: traceDiff("state/counter"), astro: noInteraction },
        "basics/hello": { react: noInteraction },
      }),
    };
    // Neither the reference, nor Astro, nor a case without actions is judged.
    expect(judgeCanary(unwired, run, ["react", "vue"], [counter, hello]).problems).toEqual([]);
    expect(judgeCanary(unwired, run, ["astro"], [counter, hello])).toEqual({
      caught: false,
      problems: ["the run covered no target the canary corrupts"],
      notes: ["astro: not judged, the canary applies to none of its cases"],
    });
  });

  it("judges a source canary on every case, a case with compile errors included", () => {
    const l1 = findCanary("L1-diagnostic-added");
    const differs = fail(
      'cases/x/__expected__/diagnostics.json differs from this run\'s output:\n+     "code": "UF1201",',
    );
    const caught = {
      status: 1,
      projects: cells(
        "L1",
        { "basics/hello": { vue: differs }, "diagnostics/rejected": { vue: differs } },
        "compile",
      ),
    };
    expect(judgeCanary(l1, caught, ["vue"], [hello, rejected]).problems).toEqual([]);
    const missed = {
      status: 1,
      projects: cells(
        "L1",
        { "basics/hello": { vue: differs }, "diagnostics/rejected": { vue: pass } },
        "compile",
      ),
    };
    expect(judgeCanary(l1, missed, ["vue"], [hello, rejected]).problems).toEqual([
      "vue › diagnostics/rejected › L1 (compile): pass, although the canary corrupted the case",
    ]);
    // A plugin canary cannot reach a case without output, so it is not judged there.
    const plugin = {
      status: 1,
      projects: cells(
        "L1",
        {
          "basics/hello": { vue: fail("__expected__/diagnostics.json differs\nUF8001") },
          "diagnostics/rejected": { vue: pass },
        },
        "compile",
      ),
    };
    const throws = findCanary("L1-plugin-throws");
    expect(judgeCanary(throws, plugin, ["vue"], [hello, rejected]).problems).toEqual([]);
  });

  it("judges a fix canary only on the cases whose diagnostics have a fix, with or without output", () => {
    const l1 = findCanary("L1-fix-no-op");
    const fixable: CanaryCase = { ...rejected, id: "diagnostics/fixable", hasFixes: () => true };
    const warned: CanaryCase = {
      ...hello,
      id: "jsx/warned",
      hasFixes: (target) => target === "vue",
    };
    const unfixed = fail(
      "Applying the fixes of UF3004 does not recompile clean:\n  UF3004 `className` is written `class`",
    );
    const caught = {
      status: 1,
      projects: cells(
        "L1",
        {
          "basics/hello": { vue: pass, react: pass },
          "diagnostics/fixable": { vue: unfixed, react: unfixed },
          "jsx/warned": { vue: unfixed, react: pass },
        },
        "compile",
      ),
    };
    expect(judgeCanary(l1, caught, ["react", "vue"], [hello, fixable, warned])).toEqual({
      caught: true,
      problems: [],
      notes: [],
    });
    const missed = {
      status: 1,
      projects: cells(
        "L1",
        {
          "diagnostics/fixable": { vue: pass },
          "jsx/warned": {
            vue: fail("__expected__/diagnostics.json differs from this run's output"),
          },
        },
        "compile",
      ),
    };
    expect(judgeCanary(l1, missed, ["vue"], [hello, fixable, warned]).problems).toEqual([
      "vue › diagnostics/fixable › L1 (compile): pass, although the canary corrupted the case",
      expect.stringMatching(
        /^vue › jsx\/warned › L1 \(compile\): failed, but not in the compile fixes check \(.+\): __expected__\/diagnostics\.json differs/,
      ),
    ]);
    // A corpus with no fixable case cannot prove it: no target is judged.
    expect(judgeCanary(l1, caught, ["vue"], [hello])).toEqual({
      caught: false,
      problems: ["the run covered no target the canary corrupts"],
      notes: ["vue: not judged, the canary applies to none of its cases"],
    });
  });

  describe("a check that fails a spec's import", () => {
    const guard = findCanary("L6-golden-guard");
    const ssr = cells(
      "L6",
      {
        "basics/hello": { vue: fail(guarded("vue")), react: fail(guarded("react")) },
        "basics/no-spec": { vue: fail(guarded("vue")), react: fail(guarded("react")) },
      },
      "ssr",
    );

    it("is proven by each browser project's load error for each spec", () => {
      const run = {
        status: 1,
        projects: ssr,
        loadFailures: [
          { project: "browser:react", file: hello.spec!, errors: [guarded("react")] },
          { project: "browser:vue", file: hello.spec!, errors: [guarded("vue")] },
        ],
      };
      expect(judgeCanary(guard, run, ["react", "vue"], [hello, noSpec, rejected])).toEqual({
        caught: true,
        problems: [],
        notes: [],
      });
    });

    it("is required of a spec whose every test its target skips: the import fails first", () => {
      const mounted: CanaryCase = { ...hello, runs: interactive };
      const run = {
        status: 1,
        projects: cells("L6", { "basics/hello": { astro: fail(guarded("astro")) } }, "ssr"),
        loadFailures: [],
      };
      expect(judgeCanary(guard, run, ["astro"], [mounted]).problems).toEqual([
        `astro › basics/hello › browser:astro: ${hello.spec} loaded, although the canary corrupted the case`,
      ]);
    });

    it("fails a spec that loaded, or failed to load for another reason", () => {
      const run = {
        status: 1,
        projects: ssr,
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
      expect(judgeCanary(guard, { status: 1, projects: ssr }, ["vue"], [hello])).toEqual({
        caught: false,
        problems: ["the run wrote no list of the specs it could not load"],
        notes: [],
      });
    });
  });
});

// M2's shapes, on all seven targets: Astro runs no client code, so its browser project skips
// every test that requires interactivity, and records the skip in each of those tests' cells.
describe("judgeCanary on seven targets", () => {
  /** A case whose spec checks a scenario first and acts in a test that requires interactivity. */
  const counter: CanaryCase = {
    ...hello,
    id: "state/counter",
    spec: spec("state/counter"),
    interacts: interactive,
    listens: true,
  };
  /**
   * A static test beside one that rerenders and requires interactivity (semantics/setup-once):
   * on Astro only the static test runs, and its L9 is "no scripted interaction".
   */
  const setupOnce: CanaryCase = {
    ...hello,
    id: "semantics/setup-once",
    spec: spec("semantics/setup-once"),
    rerenders: interactive,
  };
  /** A static rerender that every target runs, Astro included (semantics/reactive-props). */
  const reactiveProps: CanaryCase = {
    ...hello,
    id: "semantics/reactive-props",
    spec: spec("semantics/reactive-props"),
    rerenders: () => true,
  };
  /**
   * A case.json `requires` case (lifecycle/mounted-dom): every test requires interactivity, so
   * on Astro no browser test runs, and only the server render checks it.
   */
  const mountedDom: CanaryCase = {
    ...hello,
    id: "lifecycle/mounted-dom",
    spec: spec("lifecycle/mounted-dom"),
    runs: interactive,
    interacts: interactive,
    listens: true,
  };

  it("judges L9-unwired-handler on the six followers, and says Astro is not judged", () => {
    const unwired = findCanary("L9-unwired-handler");
    const run = {
      status: 1,
      projects: cells("L9", {
        "state/counter": everyTarget((target) =>
          target === "vue"
            ? pass
            : interactive(target)
              ? traceDiff("state/counter")
              : noInteraction,
        ),
        "basics/hello": everyTarget(() => noInteraction),
      }),
    };
    const verdict = judgeCanary(unwired, run, TARGET_NAMES, [counter, hello]);
    expect(verdict).toEqual({
      caught: true,
      problems: [],
      notes: ["astro: not judged, the canary applies to none of its cases"],
    });
    // A follower whose step was never compared is still a blind spot of the trace check.
    const aborted = {
      status: 1,
      projects: merged(
        run.projects,
        cells("L9", {
          "state/counter": {
            solid: fail("1 step(s) of uf-root-2 were never compared (click …)"),
          },
        }),
      ),
    };
    expect(judgeCanary(unwired, aborted, TARGET_NAMES, [counter, hello]).problems).toEqual([
      expect.stringMatching(
        /^solid › state\/counter › L9 \(browser:solid\): failed, but not in the browser trace check/,
      ),
    ]);
  });

  it("judges L13-qwik-handler-throws on Qwik's cases that act, and no other target", () => {
    const throwing = findCanary("L13-qwik-handler-throws");
    const qwikError = fail(
      "1 unexpected console message(s):\n  console.error: QWIK ERROR [uf canary] L13 in qwik Error: [uf canary] L13 in qwik",
    );
    // Only Qwik's project ran: the runner runs no other target's for a canary of Qwik's code.
    const run = {
      status: 1,
      projects: cells("L13", {
        "state/counter": { qwik: qwikError },
        "basics/hello": { qwik: pass },
      }),
    };
    expect(judgeCanary(throwing, run, TARGET_NAMES, [counter, hello])).toEqual({
      caught: true,
      problems: [],
      notes: [],
    });
    // A console error for another reason, or none, is a blind spot.
    const silent = {
      status: 1,
      projects: cells("L13", {
        "state/counter": {
          qwik: fail("1 unexpected console message(s):\n  console.error: QWIK ERROR offline"),
        },
      }),
    };
    expect(judgeCanary(throwing, silent, TARGET_NAMES, [counter, hello]).problems).toEqual([
      expect.stringMatching(
        /^qwik › state\/counter › L13 \(browser:qwik\): failed, but not in the browser page console check/,
      ),
    ]);
    const passed = { status: 1, projects: cells("L13", { "state/counter": { qwik: pass } }) };
    expect(judgeCanary(throwing, passed, TARGET_NAMES, [counter]).problems).toEqual([
      "qwik › state/counter › L13 (browser:qwik): pass, although the canary corrupted the case",
    ]);
    // A run without Qwik covers nothing it corrupts.
    expect(judgeCanary(throwing, run, ["vue", "react"], [counter]).problems).toEqual([
      "the run covered no target the canary corrupts",
    ]);
  });

  it("judges L9-rerender-text where a rerendering test ran, beside a static test on Astro", () => {
    const rerender = findCanary("L9-rerender-text");
    const run = {
      status: 1,
      projects: cells("L9", {
        "semantics/setup-once": everyTarget((target) =>
          interactive(target) ? traceDiff("semantics/setup-once") : noInteraction,
        ),
        "semantics/reactive-props": everyTarget(() => traceDiff("semantics/reactive-props")),
      }),
    };
    expect(judgeCanary(rerender, run, TARGET_NAMES, [setupOnce, reactiveProps, hello])).toEqual({
      caught: true,
      problems: [],
      notes: [],
    });
    // Astro's static rerender must still be caught.
    const missed = {
      status: 1,
      projects: merged(run.projects, cells("L9", { "semantics/reactive-props": { astro: pass } })),
    };
    expect(
      judgeCanary(rerender, missed, TARGET_NAMES, [setupOnce, reactiveProps]).problems,
    ).toEqual([
      "astro › semantics/reactive-props › L9 (browser:astro): pass, although the canary corrupted the case",
    ]);
  });

  it("judges L13 on a case.json requires case by its server render alone on Astro", () => {
    const l13 = findCanary("L13-console-warn");
    const run = {
      status: 1,
      projects: merged(
        cells(
          "L13",
          {
            "lifecycle/mounted-dom": everyTarget(serverWarning),
            "basics/hello": everyTarget(serverWarning),
          },
          "ssr",
        ),
        cells("L13", {
          "lifecycle/mounted-dom": everyTarget((target) =>
            interactive(target) ? pageWarning(target) : astroSkip,
          ),
          "basics/hello": everyTarget(pageWarning),
        }),
      ),
    };
    expect(judgeCanary(l13, run, TARGET_NAMES, [mountedDom, hello])).toEqual({
      caught: true,
      problems: [],
      notes: [],
    });
    // The server render still has to catch it there.
    const missed = {
      status: 1,
      projects: merged(
        run.projects,
        cells("L13", { "lifecycle/mounted-dom": { astro: pass } }, "ssr"),
      ),
    };
    expect(judgeCanary(l13, missed, TARGET_NAMES, [mountedDom, hello]).problems).toEqual([
      "astro › lifecycle/mounted-dom › L13 (ssr:astro): pass, although the canary corrupted the case",
    ]);
  });

  it("judges L8 on every target, and on Astro only the cases whose tests run there", () => {
    const l8 = findCanary("L8-render-nothing");
    const missing = fail(
      "VitestBrowserElementError: Cannot find element with locator: getByTestId('uf-root-1').getByRole('status')",
    );
    const run = {
      status: 1,
      projects: cells("L8", {
        "lifecycle/mounted-dom": everyTarget((target) =>
          interactive(target) ? missing : astroSkip,
        ),
        "basics/hello": everyTarget(() => missing),
      }),
    };
    expect(judgeCanary(l8, run, TARGET_NAMES, [mountedDom, hello])).toEqual({
      caught: true,
      problems: [],
      notes: [],
    });
    // A case whose only test runs nowhere on Astro cannot prove it there alone.
    expect(judgeCanary(l8, run, ["astro"], [mountedDom]).problems).toEqual([
      "astro: no case could prove it in the browser projects",
    ]);
  });
});
