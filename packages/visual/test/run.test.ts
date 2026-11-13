// The visual run end to end, in Chromium: a fixture example that renders differently on one
// target fails the run, and the report says where and how.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { renderReport } from "../src/report-page.ts";
import type { VisualReport } from "../src/report.ts";
import { runVisual } from "../src/run.ts";
import { pixelAt } from "./png.ts";

const fixture = (name: string) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

describe("runVisual", () => {
  it("reports a difference", { timeout: 180_000 }, async () => {
    const root = fixture("differs");
    let printed = "";
    const result = await runVisual({ root, env: {}, stdout: (text) => void (printed += text) });

    expect(result.exitCode).toBe(1);
    const report = JSON.parse(readFileSync(result.reportPath!, "utf8")) as VisualReport;
    expect(report).toEqual(result.report);
    expect(report.passed).toBe(false);
    const [box] = report.examples;
    expect(box?.id).toBe("examples/Box");
    const react = box!.cells.find((cell) => cell.target === "react")!;
    const vue = box!.cells.find((cell) => cell.target === "vue")!;
    expect(vue).toMatchObject({ role: "reference", status: "passed" });
    expect(react).toMatchObject({
      role: "follower",
      status: "failed",
      outcome: "geometry-mismatch",
    });
    expect(react.diffPixels).toBeGreaterThan(0);
    expect(react.geometry).toContainEqual(
      expect.objectContaining({
        property: "background-color",
        expected: "rgb(37, 99, 235)",
        actual: "rgb(220, 38, 38)",
      }),
    );
    const out = join(root, ".unframework", "visual");
    for (const image of ["capture", "reference", "actual", "diff", "geometry"] as const) {
      expect(react.images[image], image).toBeDefined();
      expect(existsSync(join(out, react.images[image]!)), image).toBe(true);
    }
    expect(react.images.diff).toBe("examples/Box/react/diff.png");
    // The page beside the report, which names its images by the same relative paths.
    const html = readFileSync(join(out, "report.html"), "utf8");
    expect(html).toBe(renderReport(report));
    expect(html).toContain('src="examples/Box/react/diff.png"');
    expect(printed).toContain("✗ examples/Box: failed on react (geometry-mismatch)");
  });

  it(
    "fails an example whose test fails after its capture, and one that doesn't compile, alone",
    {
      timeout: 180_000,
    },
    async () => {
      const root = fixture("mixed");
      let printed = "";
      const result = await runVisual({ root, env: {}, stdout: (text) => void (printed += text) });

      expect(result.exitCode).toBe(1);
      const cells = Object.fromEntries(
        result.report!.examples.map((example) => [example.id, example.cells]),
      );
      // The good example passes on both targets, and its captures show it: the page's white
      // background in the corner, not the dark backdrop of Vite's error overlay.
      expect(cells["examples/Good"]!.map((cell) => cell.status)).toEqual(["passed", "passed"]);
      const out = join(root, ".unframework", "visual");
      for (const cell of cells["examples/Good"]!) {
        const capture = readFileSync(join(out, cell.images.capture!));
        expect(pixelAt(capture, 0, 0), cell.target).toEqual([255, 255, 255, 255]);
      }
      // Its console error fails the test after a capture that matched (L13).
      for (const cell of cells["examples/Noisy"]!) {
        expect(cell, cell.target).toMatchObject({ status: "failed", outcome: "test-failed" });
        expect(cell.message, cell.target).toContain("L13");
      }
      // The broken one fails on both, with the compile error.
      for (const cell of cells["examples/Broken"]!) {
        expect(cell, cell.target).toMatchObject({ status: "failed", outcome: "not-captured" });
        expect(cell.message, cell.target).toMatch(/^UF1002: /);
      }
      expect(printed).toContain("✓ examples/Good: passed on 2 targets");
      expect(printed).toContain(
        "✗ examples/Noisy: failed on react (test-failed), vue (test-failed)",
      );
    },
  );
});
