// `renderReport`'s HTML, in Node: a self-contained page, every value escaped, every image a
// relative path the report names, and the delta table's limit. The page in a browser is
// report-page.browser.test.ts.
import { describe, expect, it } from "vitest";

import { MAX_DELTA_ROWS, renderReport } from "../src/report-page.ts";
import type { VisualCell, VisualReport } from "../src/report.ts";
import { writeReportFixture } from "./report-fixture.ts";

function cell(overrides: Partial<VisualCell> = {}): VisualCell {
  return {
    target: "vue",
    role: "reference",
    status: "passed",
    outcome: "published-reference",
    message: "",
    diffPixels: null,
    geometry: [],
    images: { capture: "examples/A/vue.png" },
    ...overrides,
  };
}

function report(cells: VisualCell[], overrides: Partial<VisualReport> = {}): VisualReport {
  return {
    version: 1,
    pixels: "live",
    update: false,
    reference: "vue",
    targets: cells.map((each) => each.target),
    passed: cells.every((each) => each.status === "passed"),
    examples: [{ id: "examples/A", file: "examples/A.example.uf.tsx", cells }],
    ...overrides,
  };
}

describe("renderReport", () => {
  it("writes a whole page that makes no network request and runs no script", () => {
    for (const name of ["report-failed", "report-missing"] as const) {
      const { html } = writeReportFixture(name);
      expect(html.startsWith('<!doctype html>\n<html lang="en">')).toBe(true);
      expect(html).toMatch(/<title>Visual report: failed<\/title>/);
      expect(html).not.toMatch(/(src|href)="https?:\/\/|fetch\(|@import|<script|<link/);
    }
  });

  it("links only the images the report names, as relative paths", () => {
    const { html, report: fixture } = writeReportFixture("report-missing");
    const named = new Set(
      fixture.examples.flatMap((example) =>
        example.cells.flatMap((each) => Object.values(each.images)),
      ),
    );
    const linked = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map((match) => match[1]);
    expect(linked.length).toBeGreaterThan(0);
    for (const path of linked) expect(named).toContain(path);
  });

  it("escapes every value and encodes every path", () => {
    const html = renderReport(
      report([
        cell({
          target: "vue",
          status: "failed",
          outcome: "pixel-mismatch",
          message: '<img src=x onerror="alert(1)">',
          images: {
            capture: "https://example.com/x.png",
            actual: "a b/#c?.png",
            reference: "r.png",
          },
          geometry: [{ path: "<p>", property: "color", expected: "a&b", actual: { x: "<" } }],
        }),
      ]),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain('src="https%3A//example.com/x.png"');
    expect(html).toContain('src="a%20b/%23c%3F.png"');
    expect(html).toContain("<code>&lt;p&gt;</code>");
    expect(html).toContain("<code>a&amp;b</code>");
    expect(html).toContain("<code>{&quot;x&quot;:&quot;&lt;&quot;}</code>");
  });

  it("names the total when it lists only the first deltas", () => {
    const geometry = Array.from({ length: MAX_DELTA_ROWS + 5 }, (_, index) => ({
      path: `div[${index}]`,
      property: "box",
      expected: 1,
      actual: 2,
    }));
    const html = renderReport(
      report([cell({ status: "failed", outcome: "geometry-mismatch", geometry })]),
    );
    expect(html).toContain(`Geometry deltas: the first ${MAX_DELTA_ROWS} of ${MAX_DELTA_ROWS + 5}`);
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)).toHaveLength(MAX_DELTA_ROWS);
  });

  it("says when every cell passed, when baselines were written, and when there is nothing", () => {
    const passed = renderReport(report([cell()], { pixels: "baseline", update: true }));
    expect(passed).toContain("<title>Visual report: passed</title>");
    expect(passed).toContain("Every cell passed: 1 example on 1 target.");
    expect(passed).toContain("<dd>Written by this run</dd>");
    expect(passed).not.toContain('class="failure"');
    const empty = renderReport({ ...report([]), examples: [], targets: [] });
    expect(empty).toContain("This run has no examples.");
  });
});
