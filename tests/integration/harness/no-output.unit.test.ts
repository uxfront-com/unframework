// The browser projects' stand-ins (no-output.ts), on a corpus of their own: which cases a target
// has no output for or cannot compile yet, the import a stand-in replaces, what the stand-in
// does, and what a test run against one records and how the summary judges it (ADR-0068).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  BROWSER_LAYERS,
  buildPartialMatrix,
  recordLayer,
  recordStandIn,
  summarise,
} from "@unframework/testing/node";
import type { LayerTask, QuarantineEntry, UfLayerMeta } from "@unframework/testing/node";
import type { Plugin } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { listCases } from "./cases.ts";
import {
  NO_OUTPUT_PREFIX,
  noOutputCases,
  noOutputPlugin,
  standIn,
  standInCases,
  standInReasons,
} from "./no-output.ts";
import { QUARANTINE } from "./quarantine.ts";

let corpus: string | undefined;
afterEach(() => {
  if (corpus) rmSync(corpus, { recursive: true, force: true });
  corpus = undefined;
});

/** A corpus made of `files`, by path relative to the cases directory. */
function makeCorpus(files: Record<string, string>): string {
  corpus = mkdtempSync(join(tmpdir(), "uf-no-output-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(corpus, path)), { recursive: true });
    writeFileSync(join(corpus, path), contents);
  }
  return corpus;
}

const input = "export default function Box() {\n  return <p>Box</p>;\n}\n";
const spec = 'it("renders", { requires: ["interactivity"] }, async () => {});\n';
const diagnostic = (code: string, severity: string, message: string, target?: string) => ({
  code,
  severity,
  message,
  ...(target ? { target } : {}),
});
const declared = "The qwik target does not support conditional-event-control: it runs apart.";

/** A corpus with a declared capability error on qwik, a diagnostics case and a clean case. */
function corpusOfFour(): string {
  return makeCorpus({
    "events/declared/Box.uf.tsx": input,
    "events/declared/declared.test.ts": spec,
    "events/declared/__expected__/diagnostics.json": JSON.stringify([
      diagnostic("UF4001", "info", "The astro target does not support interactivity.", "astro"),
      diagnostic("UF4001", "error", declared, "qwik"),
    ]),
    "events/everywhere/Box.uf.tsx": input,
    "events/everywhere/everywhere.test.ts": spec,
    "events/everywhere/__expected__/diagnostics.json": JSON.stringify([
      diagnostic("UF1002", "error", "Unsupported syntax."),
    ]),
    "diagnostics/broken/Box.uf.tsx": input,
    "diagnostics/broken/__expected__/diagnostics.json": JSON.stringify([
      diagnostic("UF1002", "error", "Unsupported syntax."),
    ]),
    "basics/clean/Box.uf.tsx": input,
    "basics/clean/clean.test.ts": spec,
    "basics/clean/__expected__/diagnostics.json": "[]",
  });
}

/** Calls the plugin's `resolveId` as Vite does. */
function resolveWith(
  plugin: Plugin,
  source: string,
  importer: string | undefined,
  scan = false,
): unknown {
  const hook = plugin.resolveId as (
    this: unknown,
    source: string,
    importer: string | undefined,
    options: { attributes: Record<string, string>; isEntry: boolean; scan?: boolean },
  ) => unknown;
  return hook.call({}, source, importer, {
    attributes: {},
    isEntry: false,
    ...(scan ? { scan: true } : {}),
  });
}

/** Calls the plugin's `load` as Vite does. */
function loadWith(plugin: Plugin, id: string): unknown {
  return (plugin.load as (this: unknown, id: string) => unknown).call({}, id);
}

describe("noOutputCases", () => {
  it("lists the cases with a spec whose expected diagnostics hold an error for the target", () => {
    const cases = listCases(corpusOfFour());
    expect(noOutputCases(cases, "qwik")).toEqual({
      "events/declared": `UF4001 (${declared})`,
      "events/everywhere": "UF1002 (Unsupported syntax.)",
    });
    // A note (Astro's inert interactivity) leaves the output: its tests run, or skip by capability.
    expect(Object.keys(noOutputCases(cases, "astro"))).toEqual(["events/everywhere"]);
    expect(Object.keys(noOutputCases(cases, "vue"))).toEqual(["events/everywhere"]);
  });

  it("leaves out a case whose expectations are missing, which the compile project writes first", () => {
    const cases = listCases(
      makeCorpus({ "events/new/Box.uf.tsx": input, "events/new/new.test.ts": spec }),
    );
    expect(noOutputCases(cases, "qwik")).toEqual({});
  });
});

describe("noOutputPlugin", () => {
  it("resolves a spec's import of such a component to a stand-in that loads, and nothing else", () => {
    const dir = corpusOfFour();
    const cases = listCases(dir);
    const plugin = noOutputPlugin(cases, standInReasons(noOutputCases(cases, "qwik"), {}));
    const importer = join(dir, "events/declared/declared.test.ts");
    expect(plugin.enforce).toBe("pre");
    expect(resolveWith(plugin, "./Box.uf.tsx", importer)).toBe(
      `${NO_OUTPUT_PREFIX}events/declared`,
    );
    // The browser asks for the spec with Vite's queries.
    expect(resolveWith(plugin, "./Box.uf.tsx", `${importer}?import&browserv=1`)).toBe(
      `${NO_OUTPUT_PREFIX}events/declared`,
    );
    expect(resolveWith(plugin, "../declared/Box.uf.tsx", importer)).toBe(
      `${NO_OUTPUT_PREFIX}events/declared`,
    );
    // The dependency scan, a case the target compiles, another module and a bare specifier
    // are the unplugin's and Vite's.
    expect(resolveWith(plugin, "./Box.uf.tsx", importer, true)).toBeNull();
    expect(resolveWith(plugin, "./Box.uf.tsx", join(dir, "basics/clean/clean.test.ts"))).toBeNull();
    expect(resolveWith(plugin, "./helpers.ts", importer)).toBeNull();
    expect(resolveWith(plugin, "Box.uf.tsx", importer)).toBeNull();
    expect(resolveWith(plugin, "./Box.uf.tsx", undefined)).toBeNull();

    expect(loadWith(plugin, `${NO_OUTPUT_PREFIX}events/declared`)).toBe(
      standIn(`events/declared has no output for this target: it expects UF4001 (${declared}).`),
    );
    expect(loadWith(plugin, `${NO_OUTPUT_PREFIX}basics/clean`)).toBeNull();
    expect(loadWith(plugin, join(dir, "events/declared/Box.uf.tsx"))).toBeNull();
  });

  it("serves a component that throws the reason if anything renders it", async () => {
    const reason = 'events/declared has no qwik output: "quoted" and\nmultiline.';
    const module = (await import(
      `data:text/javascript,${encodeURIComponent(standIn(reason))}`
    )) as { default: () => unknown };
    expect(() => module.default()).toThrow(reason);
  });
});

/** An L3 entry for a case on a target, as a target's quarantine file holds it. */
const l3 = (caseId: string, target: string): QuarantineEntry => ({
  case: caseId,
  target,
  layer: "L3",
  reason: "imports no type yet",
  issue: "UXF-0",
});

describe("standInCases", () => {
  it("gives a case with an Angular L3 entry the stand-in on Angular, and none once it is gone", () => {
    const cases = listCases(corpusOfFour());
    const found = standInCases(cases, "angular", [l3("basics/clean", "angular")]);
    expect(found).toEqual({
      "basics/clean":
        "angular cannot compile this case yet, so its spec runs against a stand-in: its L3 is quarantined for UXF-0 (imports no type yet), and its browser build type-checks the output.",
    });
    expect(standInCases(cases, "angular", [])).toEqual({});
    // Another layer's entry, or another target's, leaves the case's own output.
    expect(
      standInCases(cases, "angular", [
        { ...l3("basics/clean", "angular"), layer: "L4" },
        l3("basics/clean", "react"),
      ]),
    ).toEqual({});
  });

  it("gives none on a target whose browser build erases the types (React)", () => {
    const cases = listCases(corpusOfFour());
    expect(standInCases(cases, "react", [l3("basics/clean", "react")])).toEqual({});
  });

  it("leaves out a case without a spec, which no browser project loads", () => {
    const cases = listCases(corpusOfFour());
    expect(standInCases(cases, "angular", [l3("diagnostics/broken", "angular")])).toEqual({});
  });

  it("serves its stand-in with its own cause, never the no-output message", () => {
    const dir = corpusOfFour();
    const cases = listCases(dir);
    const standIns = standInCases(cases, "angular", [l3("basics/clean", "angular")]);
    const plugin = noOutputPlugin(cases, standInReasons(noOutputCases(cases, "angular"), standIns));
    expect(resolveWith(plugin, "./Box.uf.tsx", join(dir, "basics/clean/clean.test.ts"))).toBe(
      `${NO_OUTPUT_PREFIX}basics/clean`,
    );
    expect(loadWith(plugin, `${NO_OUTPUT_PREFIX}basics/clean`)).toBe(
      standIn(standIns["basics/clean"]!),
    );
  });

  it("stands in for the corpus's cases whose Angular L3 entry stands", () => {
    const ids = Object.keys(standInCases(listCases(), "angular", QUARANTINE)).sort();
    const quarantined = [
      ...new Set(
        QUARANTINE.filter((entry) => entry.target === "angular" && entry.layer === "L3").map(
          (entry) => entry.case,
        ),
      ),
    ].filter((id) => listCases().find((info) => info.id === id)?.spec);
    expect(ids).toEqual(quarantined.sort());
    // Each has an Angular entry for every browser layer it fails, and only those.
    for (const id of ids) {
      expect(
        QUARANTINE.filter((entry) => entry.case === id && entry.target === "angular")
          .map((entry) => entry.layer)
          .filter((layer) => BROWSER_LAYERS.includes(layer)),
        id,
      ).toEqual(BROWSER_LAYERS);
    }
  });
});

describe("a test run against a stand-in", () => {
  const cause = "angular cannot compile this case yet (fixture).";
  const subject = (quarantine: readonly QuarantineEntry[] = []) => ({
    case: "basics/clean",
    target: "angular",
    quarantine,
  });

  it("records every browser layer as failed with the stand-in's cause, and skips none", () => {
    const task: LayerTask = { meta: {} };
    recordStandIn(task, subject(), cause);
    expect(task.meta.uf).toEqual({
      case: "basics/clean",
      target: "angular",
      layers: Object.fromEntries(
        BROWSER_LAYERS.map((layer) => [layer, { status: "fail", message: cause }]),
      ),
      standIn: cause,
    });
    expect(task.meta.uf?.skipped).toBeUndefined();
  });

  it("is quarantined layer by layer, and a later pass keeps the cell failed", () => {
    const entries = BROWSER_LAYERS.map((layer) => ({ ...l3("basics/clean", "angular"), layer }));
    const task: LayerTask = { meta: {} };
    recordStandIn(task, subject(entries), cause);
    // The console is clean, and the mount's error is L8's: neither hides the stand-in's failure.
    recordLayer(task, subject(entries), "L13", { status: "pass" });
    for (const layer of BROWSER_LAYERS) {
      expect(task.meta.uf?.layers[layer], layer).toEqual({ status: "quarantined", issue: "UXF-0" });
    }
  });

  it("is excused from scenario parity with the reference, and its cells still fail", () => {
    const reference: UfLayerMeta = {
      case: "basics/clean",
      target: "vue",
      layers: { L7: { status: "pass" } },
      scenarios: ["initial"],
      test: "basics/clean > renders",
    };
    const task: LayerTask = { meta: {} };
    recordStandIn(task, subject(), cause);
    const ours: UfLayerMeta = { ...task.meta.uf!, test: "basics/clean > renders" };
    const matrix = buildPartialMatrix({
      run: "all",
      projects: ["browser:vue", "browser:angular"],
      records: [
        { project: "browser:vue", record: reference },
        { project: "browser:angular", record: ours },
      ],
      finishedAt: "2026-10-28T00:00:00.000Z",
      mode: { update: false, pixels: "baseline", canary: null },
      filtered: null,
      shard: null,
      empty: [],
      quarantine: [],
      reference: "vue",
    });
    const result = summarise([matrix], {
      projects: ["browser:vue", "browser:angular"],
      cases: ["basics/clean"],
      targets: ["vue", "angular"],
      liveLayers: ["L7"],
      notLiveReason: "not live (fixture)",
    });
    expect(result.matrix.tests["basics/clean"]?.angular).toEqual({
      "basics/clean > renders": { scenarios: [], standIn: cause },
    });
    // No scenario problem: only its cells, which its quarantine entries cover in the corpus.
    expect(result.problems).toEqual(
      BROWSER_LAYERS.map((layer) => `basics/clean › angular › ${layer}: fail: ${cause}`),
    );
  });
});
