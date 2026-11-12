// The visual run end to end, in Chromium: a fixture example that renders differently on one
// target fails the run, and the report says where and how.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { VisualReport } from "../src/report.ts";
import { runVisual } from "../src/run.ts";

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
    expect(printed).toContain("✗ examples/Box: failed on react (geometry-mismatch)");
  });
});
