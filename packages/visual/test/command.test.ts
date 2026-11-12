// `ufExampleCapture` with a fake browser: where an example's capture, baselines and failures go,
// and the run's policy for examples (live, baseline, a missing baseline, a dropped reference).
// L10's comparison itself is the testing package's, tested there (visual-command.test.ts).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { BASELINE_ENVIRONMENT, ufSpecFinished } from "@unframework.dev/testing/node";
import type {
  CaptureRequest,
  GeometrySnapshot,
  HarnessContext,
  VisualCommandContext,
} from "@unframework.dev/testing/node";
import { beforeEach, describe, expect, it } from "vitest";

import { exampleLocation, takeCaptures, ufExampleCapture } from "../src/command.ts";
import type { VisualContext } from "../src/command.ts";
import { exampleBaselines } from "../src/examples.ts";
import { buildReport } from "../src/report.ts";
import { png } from "./png.ts";

const CASE = ".unframework/specs/examples/Buttons";
const EXAMPLE = "examples/Buttons";
let root: string;
let harness: HarnessContext;
let visual: VisualContext;
let runs = 0;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "uf-visual-command-"));
  const runId = `run-${(runs += 1)}`;
  harness = {
    runId,
    casesDir: root,
    reference: "vue",
    update: false,
    pixels: "live",
    canary: null,
    baselineEnvironment: null,
    browser: "chromium",
    ledgerDir: join(root, ".reports", "ledger", runId),
    liveDir: join(root, ".live", runId),
    diffsDir: join(root, ".reports", "diffs", runId),
    quarantine: [],
    cases: { [CASE]: { main: "../../../../examples/Buttons.example.uf.tsx" } },
  };
  visual = {
    out: join(root, ".unframework", "visual"),
    examples: {
      [EXAMPLE]: { file: join(root, "examples", "Buttons.example.uf.tsx"), name: "Buttons" },
    },
  };
});

const geometry = (width = 100): GeometrySnapshot => ({
  version: 1,
  nodes: { "p[0]": { box: [8, 8, width, 24], style: { color: "rgb(0, 0, 0)" } } },
});

/** The browser projects of a run, as the reference-not-run check reads them. */
const projects = (...targets: string[]) =>
  targets.map((target) => ({
    name: `browser:${target}`,
    config: { browser: { enabled: true } },
    getProvidedContext: () => ({ target }),
  }));

/** A command context for a target's project, whose screenshots return `shot`. */
function context(
  target: string,
  shot: Buffer,
  overrides: Partial<HarnessContext> = {},
  run = projects("vue", "react"),
): VisualCommandContext {
  const container = {
    nodeId: 10,
    nodeType: 1,
    localName: "div",
    attributes: ["data-uf-capture", "m-1"],
    children: [{ nodeId: 11, nodeType: 1, localName: "p" }],
  };
  const cdp = {
    async send(method: string) {
      if (method === "DOM.getDocument")
        return { root: { nodeId: 1, nodeType: 9, children: [container] } };
      if (method === "CSS.getPlatformFontsForNode") {
        return { fonts: [{ familyName: "Inter", isCustomFont: true, glyphCount: 5 }] };
      }
      return {};
    },
  };
  const fake = {
    project: {
      name: `browser:${target}`,
      getProvidedContext: () => ({
        target,
        ufHarness: { ...harness, ...overrides },
        ufVisual: visual,
      }),
      vitest: { projects: run },
    },
    page: { context: () => ({ newCDPSession: async () => cdp }) },
    iframe: { locator: () => ({ screenshot: async () => shot }) },
  };
  return fake as unknown as VisualCommandContext;
}

const request = (snapshot = geometry()): CaptureRequest & { example: string } => ({
  element: { selector: 'internal:testid=[data-testid="uf-root-1"s]', locator: "" },
  case: CASE,
  name: "example",
  geometry: snapshot,
  marker: "m-1",
  example: EXAMPLE,
});

const commit = (path: string, contents: string | Buffer) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

describe("exampleLocation", () => {
  it("puts the baselines beside the example and the images in the run directory", () => {
    const location = exampleLocation(visual, CASE, "vue", EXAMPLE, "react");
    const baselines = exampleBaselines(visual.examples[EXAMPLE]!);
    expect(location).toEqual({
      key: "example:examples/Buttons",
      label: "examples/Buttons",
      case: CASE,
      reference: "vue",
      baselinePng: join(root, "examples", "__screenshots__", "Buttons-chromium-linux.png"),
      geometry: join(root, "examples", "__expected__", "geometry.Buttons.json"),
      livePng: join(visual.out, "examples", "Buttons", "vue.png"),
      capture: join(visual.out, "examples", "Buttons", "react.png"),
      diffs: join(visual.out, "examples", "Buttons", "react"),
      baselineCommand: "unframework visual --update",
    });
    expect([location.baselinePng, location.geometry]).toEqual([baselines.png, baselines.geometry]);
  });

  it("refuses an example the run does not know, and a path out of the run directory", () => {
    expect(() => exampleLocation(visual, CASE, "vue", "examples/Other", "react")).toThrow(
      'Unknown example "examples/Other"',
    );
    visual.examples["../escape"] = { file: join(root, "x.example.uf.tsx"), name: "x" };
    expect(() => exampleLocation(visual, CASE, "vue", "../escape", "react")).toThrow(
      "Unknown example",
    );
  });
});

describe("ufExampleCapture with live pixels", () => {
  it("publishes the reference's capture, compares a follower with it, and keeps every capture", async () => {
    const reference = await ufExampleCapture(context("vue", png(20, 10)), request());
    expect(reference).toMatchObject({
      pass: true,
      outcome: "published-reference",
      role: "reference",
    });
    const follower = await ufExampleCapture(context("react", png(20, 10)), request());
    expect(follower).toMatchObject({ pass: true, outcome: "matched", role: "follower" });
    for (const target of ["vue", "react"]) {
      expect(existsSync(join(visual.out, "examples", "Buttons", `${target}.png`)), target).toBe(
        true,
      );
    }
    expect(follower.capture).toBe(join(visual.out, "examples", "Buttons", "react.png"));
    // Nothing committed is written beside the example.
    expect(existsSync(join(root, "examples"))).toBe(false);
    expect(takeCaptures(harness.runId).map((each) => [each.example, each.target])).toEqual([
      [EXAMPLE, "vue"],
      [EXAMPLE, "react"],
    ]);
    expect(takeCaptures(harness.runId)).toEqual([]);
  });

  it("leaves a follower's failure, with its diff and geometry, under its target's directory", async () => {
    await ufExampleCapture(context("vue", png(20, 10)), request());
    const result = await ufExampleCapture(context("react", png(20, 10, 0)), request(geometry(90)));
    expect(result).toMatchObject({ pass: false, outcome: "geometry-mismatch", diffPixels: 200 });
    expect(result.deltas).toEqual([
      { path: "p[0]", property: "box", expected: [8, 8, 100, 24], actual: [8, 8, 90, 24] },
    ]);
    const failures = join(visual.out, "examples", "Buttons", "react");
    for (const file of ["reference.png", "actual.png", "diff.png", "geometry.actual.json"]) {
      expect(existsSync(join(failures, file)), file).toBe(true);
    }
  });

  it("fails a follower whose reference never finished the example, and the report marks it failed", async () => {
    const result = await ufExampleCapture(context("react", png(20, 10)), request());
    expect(result).toMatchObject({
      pass: false,
      outcome: "reference-not-run",
      referenceProject: "browser:vue",
    });
    expect(result.message).toContain(`did not finish ${CASE}'s spec file`);
    const report = buildReport({
      root,
      out: visual.out,
      pixels: "live",
      update: false,
      reference: "vue",
      targets: ["react", "vue"],
      examples: [{ id: EXAMPLE, file: visual.examples[EXAMPLE]!.file }],
      captures: takeCaptures(harness.runId),
    });
    expect(report.passed).toBe(false);
    expect(report.examples[0]!.cells).toMatchObject([
      { target: "react", status: "failed", outcome: "reference-not-run" },
      { target: "vue", status: "failed", outcome: "not-captured" },
    ]);
  });

  it("fails a follower whose reference finished without capturing", async () => {
    ufSpecFinished(context("vue", png(20, 10)) as never, { case: CASE });
    const result = await ufExampleCapture(context("react", png(20, 10)), request());
    expect(result).toMatchObject({ pass: false, outcome: "missing-reference-capture" });
  });
});

describe("ufExampleCapture with baseline pixels", () => {
  const baseline = { pixels: "baseline" as const };

  it("compares with the baselines beside the example", async () => {
    const { png: file, geometry: json } = exampleBaselines(visual.examples[EXAMPLE]!);
    commit(file, png(20, 10));
    commit(json, `${JSON.stringify(geometry(), null, 2)}\n`);
    const same = await ufExampleCapture(context("react", png(20, 10), baseline), request());
    expect(same).toMatchObject({ pass: true, outcome: "matched", mode: "check+baseline" });
    // The reference compares with them too: nothing is live.
    const reference = await ufExampleCapture(context("vue", png(20, 10, 0), baseline), request());
    expect(reference).toMatchObject({ pass: false, outcome: "pixel-mismatch", role: "reference" });
  });

  it("fails missing-artefact when the example has no baselines, naming the command that writes them", async () => {
    const result = await ufExampleCapture(context("vue", png(20, 10), baseline), request());
    expect(result).toMatchObject({ pass: false, outcome: "missing-artefact" });
    // Paths read from the project's parent, as every message of a project's run does.
    const project = basename(root);
    expect(result.message).toBe(
      `Missing artefact ${project}/examples/__expected__/geometry.Buttons.json and ${project}/examples/__screenshots__/Buttons-chromium-linux.png. Run \`unframework visual --update\` to write it (the reference target, vue, in the Linux image).`,
    );
    expect(existsSync(join(visual.out, "examples", "Buttons", "vue", "actual.png"))).toBe(true);
  });

  it("writes the reference's baselines beside the example in the baseline environment only", async () => {
    const update = { pixels: "baseline" as const, update: true };
    const refused = await ufExampleCapture(context("vue", png(20, 10), update), request());
    expect(refused).toMatchObject({ pass: false, outcome: "refused-write" });
    expect(refused.message).toContain("(`unframework visual --update`)");
    const written = await ufExampleCapture(
      context("vue", png(20, 10), { ...update, baselineEnvironment: BASELINE_ENVIRONMENT }),
      request(),
    );
    expect(written).toMatchObject({ pass: true, outcome: "wrote-reference" });
    const { png: file, geometry: json } = exampleBaselines(visual.examples[EXAMPLE]!);
    expect(readFileSync(file).equals(png(20, 10))).toBe(true);
    expect(JSON.parse(readFileSync(json, "utf8"))).toEqual(geometry());
  });
});

describe("ufExampleCapture outside a visual run", () => {
  it("refuses a project that provides no visual context", async () => {
    const fake = context("vue", png(20, 10));
    const bare = {
      ...fake,
      project: {
        ...fake.project,
        getProvidedContext: () => ({ target: "vue", ufHarness: harness }),
      },
    } as VisualCommandContext;
    await expect(ufExampleCapture(bare, request())).rejects.toThrow('does not provide "ufVisual"');
  });
});
