// `ufVisualCapture` with a fake browser: every branch of L10's policy (live, baseline, update),
// every comparison (geometry, size, pixels, tolerance), the font audit and capture stability.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { PNG } from "pngjs";
import { beforeEach, describe, expect, it } from "vitest";

import type { HarnessContext } from "../src/harness.ts";
import { BASELINE_ENVIRONMENT } from "../src/node/mode.ts";
import { ufVisualCapture } from "../src/node/visual.ts";
import type { VisualCommandContext } from "../src/node/visual.ts";
import type { CaptureRequest, GeometrySnapshot } from "../src/visual-types.ts";

let harness: HarnessContext;
let runs = 0;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "uf-visual-"));
  // A fresh run id per test: the reference's captures are kept per run.
  const runId = `run-${(runs += 1)}`;
  harness = {
    runId,
    casesDir: join(root, "cases"),
    reference: "vue",
    update: false,
    pixels: "live",
    canary: null,
    baselineEnvironment: null,
    ledgerDir: join(root, ".reports", "ledger", runId),
    liveDir: join(root, ".live", runId),
    diffsDir: join(root, ".reports", "diffs", runId),
    quarantine: [],
    cases: { "basics/hello": {} },
  };
});

/** A solid-colour PNG. */
function png(width: number, height: number, red = 255): Buffer {
  const image = new PNG({ width, height });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = red;
    image.data[index + 1] = 255;
    image.data[index + 2] = 255;
    image.data[index + 3] = 255;
  }
  return PNG.sync.write(image);
}

const geometry = (width = 100): GeometrySnapshot => ({
  version: 1,
  nodes: { "p[0]": { box: [8, 8, width, 24], style: { color: "rgb(0, 0, 0)" } } },
});

type Fonts = { familyName: string; isCustomFont: boolean; glyphCount: number }[];

interface FakeBrowser {
  /** What each screenshot returns, in order; the last one repeats. */
  shots: Buffer[];
  /** The fonts CDP reports for every element under the container, or per node id. */
  fonts: Fonts | Record<number, Fonts>;
  /** Whether the capture container is in the document. */
  found?: boolean;
}

/**
 * The pierced document CDP returns: the orchestrator page, the tester iframe, and in it the
 * capture container holding a `<p>` with a `::before` and a `<textarea>` with its user-agent
 * shadow root.
 */
const pierced = (marker: string | undefined) => ({
  root: {
    nodeId: 1,
    nodeType: 9,
    children: [
      {
        nodeId: 2,
        nodeType: 1,
        localName: "iframe",
        contentDocument: {
          nodeId: 3,
          nodeType: 9,
          children: [
            {
              nodeId: 10,
              nodeType: 1,
              localName: "div",
              attributes: [
                "data-testid",
                "uf-root-1",
                ...(marker ? ["data-uf-capture", marker] : []),
              ],
              children: [
                {
                  nodeId: 11,
                  nodeType: 1,
                  localName: "p",
                  children: [{ nodeId: 12, nodeType: 3 }],
                  pseudoElements: [
                    { nodeId: 13, nodeType: 1, localName: "", pseudoType: "before" },
                  ],
                },
                {
                  nodeId: 14,
                  nodeType: 1,
                  localName: "textarea",
                  shadowRoots: [
                    {
                      nodeId: 15,
                      nodeType: 11,
                      children: [{ nodeId: 16, nodeType: 1, localName: "div" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  },
});

function context(target: string, browser: FakeBrowser, overrides: Partial<HarnessContext> = {}) {
  let shot = 0;
  const cdp = {
    async send(method: string, params?: { nodeId?: number }) {
      switch (method) {
        case "DOM.getDocument":
          return pierced(browser.found === false ? undefined : "m-1");
        case "CSS.getPlatformFontsForNode":
          return {
            fonts: Array.isArray(browser.fonts)
              ? browser.fonts
              : (browser.fonts[params?.nodeId ?? 0] ?? inter),
          };
        default:
          return {};
      }
    },
  };
  const fake = {
    project: {
      name: `browser:${target}`,
      getProvidedContext: () => ({ target, ufHarness: { ...harness, ...overrides } }),
    },
    page: { context: () => ({ newCDPSession: async () => cdp }) },
    iframe: {
      locator: () => ({
        screenshot: async () => browser.shots[Math.min((shot += 1) - 1, browser.shots.length - 1)]!,
      }),
    },
  };
  return fake as unknown as VisualCommandContext;
}

const inter = [{ familyName: "Inter", isCustomFont: true, glyphCount: 13 }];
const request = (snapshot: GeometrySnapshot = geometry()): CaptureRequest => ({
  element: { selector: 'internal:testid=[data-testid="uf-root-1"s]', locator: "" },
  case: "basics/hello",
  name: "initial",
  geometry: snapshot,
  marker: "m-1",
});

const baselines = () => {
  const dir = join(harness.casesDir, "basics", "hello");
  return {
    geometry: join(dir, "__expected__", "geometry.initial.json"),
    png: join(dir, "__screenshots__", "initial-chromium-linux.png"),
  };
};
const commit = (path: string, contents: string | Buffer) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

describe("ufVisualCapture with live pixels", () => {
  it("publishes the reference's capture, which is the expectation, and writes nothing committed", async () => {
    const result = await ufVisualCapture(
      context("vue", { shots: [png(20, 10)], fonts: inter }),
      request(),
    );
    expect(result).toMatchObject({
      pass: true,
      outcome: "published-reference",
      role: "reference",
      mode: "check+live",
    });
    expect(existsSync(join(harness.liveDir, "basics/hello", "initial.png"))).toBe(true);
    expect(existsSync(baselines().geometry)).toBe(false);
  });

  it("matches a follower that renders the same", async () => {
    await ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), request());
    const result = await ufVisualCapture(
      context("react", { shots: [png(20, 10)], fonts: inter }),
      request(),
    );
    expect(result).toMatchObject({
      pass: true,
      outcome: "matched",
      role: "follower",
      diffPixels: 0,
    });
  });

  it("fails a follower whose geometry differs, first, with the deltas and the images", async () => {
    await ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), request());
    const result = await ufVisualCapture(
      context("react", { shots: [png(20, 10, 0)], fonts: inter }),
      request(geometry(101)),
    );
    expect(result.outcome).toBe("geometry-mismatch");
    expect(result.message).toContain("p[0]  box: [8,8,100,24] → [8,8,101,24]");
    expect(result.message).toContain("200 pixel(s) differ");
    expect(result.attachments.map((attachment) => attachment.name)).toEqual([
      "reference",
      "actual",
      "diff",
    ]);
    expect(existsSync(join(harness.diffsDir, "basics/hello", "initial.react", "diff.png"))).toBe(
      true,
    );
  });

  it("fails a follower whose pixels differ, counting exact RGBA differences", async () => {
    await ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), request());
    const result = await ufVisualCapture(
      context("svelte", { shots: [png(20, 10, 254)], fonts: inter }),
      request(),
    );
    expect(result).toMatchObject({ pass: false, outcome: "pixel-mismatch", diffPixels: 200 });
  });

  it("fails a follower whose capture has another size", async () => {
    await ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), request());
    const result = await ufVisualCapture(
      context("solid", { shots: [png(20, 12)], fonts: inter }),
      request(),
    );
    expect(result.outcome).toBe("size-mismatch");
    expect(result.message).toContain("The capture is 20×12px");
  });

  it("accepts pixel differences within a tolerance that has a reason", async () => {
    await ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), request());
    const result = await ufVisualCapture(
      context("qwik", { shots: [png(20, 10, 254)], fonts: inter }),
      {
        ...request(),
        tolerance: { maxDiffPixels: 200, reason: "sub-pixel antialiasing in the fixture" },
      },
    );
    expect(result).toMatchObject({
      pass: true,
      outcome: "matched-within-tolerance",
      diffPixels: 200,
    });
    await expect(
      ufVisualCapture(context("qwik", { shots: [png(20, 10)], fonts: inter }), {
        ...request(),
        tolerance: { maxDiffPixels: 1, reason: "" },
      }),
    ).rejects.toThrow(/tolerance needs a reason/);
  });

  it("fails a follower when the reference captured nothing in this run", async () => {
    const result = await ufVisualCapture(
      context("react", { shots: [png(20, 10)], fonts: inter }),
      request(),
    );
    expect(result.outcome).toBe("missing-reference-capture");
    expect(result.message).toMatch(
      /The reference target \(vue\) did not capture basics\/hello\/initial/,
    );
  });
});

describe("ufVisualCapture with baseline pixels", () => {
  const baseline = { pixels: "baseline" } as const;

  it("compares every target, the reference included, with the committed baselines", async () => {
    commit(baselines().geometry, `${JSON.stringify(geometry(), null, 2)}\n`);
    commit(baselines().png, png(20, 10));
    for (const target of ["vue", "react"]) {
      const result = await ufVisualCapture(
        context(target, { shots: [png(20, 10)], fonts: inter }, baseline),
        request(),
      );
      expect(result).toMatchObject({ pass: true, outcome: "matched", mode: "check+baseline" });
    }
    const drift = await ufVisualCapture(
      context("vue", { shots: [png(20, 10)], fonts: inter }, baseline),
      request(geometry(99)),
    );
    expect(drift.outcome).toBe("geometry-mismatch");
    expect(drift.message).toContain(
      "Geometry and computed styles differ from cases/basics/hello/__expected__/geometry.initial.json (1)",
    );
  });

  it("fails on missing baselines, naming the command that writes them", async () => {
    const result = await ufVisualCapture(
      context("react", { shots: [png(20, 10)], fonts: inter }, baseline),
      request(),
    );
    expect(result.outcome).toBe("missing-artefact");
    expect(result.message).toBe(
      "Missing artefact cases/basics/hello/__expected__/geometry.initial.json and cases/basics/hello/__screenshots__/initial-chromium-linux.png. Run `pnpm test:baselines` to write it (the reference target, vue, in the Linux image).",
    );
  });

  it("lets only the reference write in update mode, and the followers compare with it", async () => {
    const update = {
      pixels: "baseline",
      update: true,
      baselineEnvironment: BASELINE_ENVIRONMENT,
    } as const;
    const follower = await ufVisualCapture(
      context("react", { shots: [png(20, 10)], fonts: inter }, update),
      request(),
    );
    expect(follower.outcome).toBe("missing-reference-capture");
    expect(existsSync(baselines().png)).toBe(false);

    const reference = await ufVisualCapture(
      context("vue", { shots: [png(20, 10)], fonts: inter }, update),
      request(),
    );
    expect(reference).toMatchObject({
      pass: true,
      outcome: "wrote-reference",
      mode: "update+baseline",
    });
    expect(JSON.parse(readFileSync(baselines().geometry, "utf8"))).toEqual(geometry());
    expect(PNG.sync.read(readFileSync(baselines().png)).width).toBe(20);

    const after = await ufVisualCapture(
      context("react", { shots: [png(20, 10, 0)], fonts: inter }, update),
      request(),
    );
    expect(after.outcome).toBe("pixel-mismatch");
    expect(PNG.sync.read(readFileSync(baselines().png)).data[0]).toBe(255);
  });

  it("refuses to write the committed baselines outside the baseline environment", async () => {
    for (const baselineEnvironment of [
      null,
      "mcr.microsoft.com/playwright:v1.63.0-noble linux/arm64",
    ]) {
      const result = await ufVisualCapture(
        context(
          "vue",
          { shots: [png(20, 10)], fonts: inter },
          { pixels: "baseline", update: true, baselineEnvironment },
        ),
        request(),
      );
      expect(result).toMatchObject({ pass: false, outcome: "refused-write" });
      expect(result.message).toContain(
        `the committed baselines come from ${BASELINE_ENVIRONMENT} (\`pnpm test:baselines\`)`,
      );
    }
    expect(existsSync(baselines().png)).toBe(false);
    expect(existsSync(baselines().geometry)).toBe(false);
  });

  it("names the reference's capture, not the committed file, when that is what geometry is compared with", async () => {
    const update = {
      pixels: "baseline",
      update: true,
      baselineEnvironment: BASELINE_ENVIRONMENT,
    } as const;
    await ufVisualCapture(
      context("vue", { shots: [png(20, 10)], fonts: inter }, update),
      request(),
    );
    const result = await ufVisualCapture(
      context("react", { shots: [png(20, 10)], fonts: inter }, update),
      request(geometry(101)),
    );
    expect(result.message).toContain(
      "Geometry and computed styles differ from vue's capture in this run (1)",
    );
    expect(result.message).not.toContain("geometry.initial.json");
  });
});

describe("ufVisualCapture's preconditions", () => {
  it("fails text rendered with a font outside the bundle, before comparing", async () => {
    const result = await ufVisualCapture(
      context("vue", {
        shots: [png(20, 10)],
        fonts: {
          11: [...inter, { familyName: "Hiragino Sans", isCustomFont: false, glyphCount: 2 }],
        },
      }),
      request(),
    );
    expect(result).toMatchObject({ pass: false, outcome: "font-fallback" });
    expect(result.message).toContain('<p> rendered 2 glyph(s) with "Hiragino Sans" (system font)');
  });

  it("audits user-agent shadow roots and generated content, named after their element", async () => {
    const fallback = [{ familyName: "Hiragino Sans", isCustomFont: false, glyphCount: 2 }];
    const result = await ufVisualCapture(
      context("vue", { shots: [png(20, 10)], fonts: { 13: fallback, 16: fallback } }),
      request(),
    );
    expect(result.outcome).toBe("font-fallback");
    expect(result.message).toBe(
      [
        "Text rendered with a font outside the bundle:",
        '  <p>::before rendered 2 glyph(s) with "Hiragino Sans" (system font)',
        '  <textarea> rendered 2 glyph(s) with "Hiragino Sans" (system font)',
      ].join("\n"),
    );
  });

  it("rejects a web font that is not the bundled one", async () => {
    const result = await ufVisualCapture(
      context("vue", {
        shots: [png(20, 10)],
        fonts: [{ familyName: "Roboto", isCustomFont: true, glyphCount: 1 }],
      }),
      request(),
    );
    expect(result.message).toContain('rendered 1 glyph(s) with "Roboto"');
  });

  it("fails when two consecutive screenshots never agree", async () => {
    const shots = Array.from({ length: 12 }, (_, index) => png(20, 10, index));
    const result = await ufVisualCapture(context("vue", { shots, fonts: inter }), request());
    expect(result).toMatchObject({ pass: false, outcome: "unstable" });
  });

  it("refuses a container the font audit cannot find, and malformed requests", async () => {
    await expect(
      ufVisualCapture(
        context("vue", { shots: [png(20, 10)], fonts: inter, found: false }),
        request(),
      ),
    ).rejects.toThrow(/could not find the capture container m-1/);
    for (const name of ["Initial", "after--click", "open-"]) {
      await expect(
        ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), {
          ...request(),
          name,
        }),
      ).rejects.toThrow(/kebab-case/);
    }
    await expect(
      ufVisualCapture(context("vue", { shots: [png(20, 10)], fonts: inter }), {
        ...request(),
        case: "../x",
      }),
    ).rejects.toThrow(/Unknown case/);
  });
});
