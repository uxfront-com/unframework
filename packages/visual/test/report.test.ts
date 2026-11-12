// `report.json`: the shape of `VisualReport`, every cell of every example, and the lines the
// command prints.
import { describe, expect, it } from "vitest";

import { buildReport, cellKey, formatReport, REPORT_VERSION } from "../src/report.ts";
import type { RecordedCapture, VisualCell, VisualReport } from "../src/report.ts";

const OUT = "/p/.unframework/visual";
const base = { mode: "check+live", attachments: [] };

const captures: RecordedCapture[] = [
  {
    example: "examples/Buttons",
    target: "vue",
    result: {
      ...base,
      pass: true,
      role: "reference",
      outcome: "published-reference",
      message: "The reference's capture is this run's expectation (live).",
      capture: `${OUT}/examples/Buttons/vue.png`,
    },
  },
  {
    example: "examples/Buttons",
    target: "react",
    result: {
      ...base,
      pass: true,
      role: "follower",
      outcome: "matched",
      message: "",
      diffPixels: 0,
      capture: `${OUT}/examples/Buttons/react.png`,
    },
  },
  {
    example: "examples/Card",
    target: "vue",
    result: {
      ...base,
      pass: true,
      role: "reference",
      outcome: "published-reference",
      message: "",
      capture: `${OUT}/examples/Card/vue.png`,
    },
  },
  {
    example: "examples/Card",
    target: "react",
    result: {
      ...base,
      pass: false,
      role: "follower",
      outcome: "pixel-mismatch",
      message: "12 pixel(s) differ",
      diffPixels: 12,
      deltas: [{ path: "p[0]", property: "color", expected: "red", actual: "blue" }],
      capture: `${OUT}/examples/Card/react.png`,
      attachments: [
        {
          name: "reference",
          path: `${OUT}/examples/Card/react/reference.png`,
          width: 2,
          height: 2,
        },
        { name: "actual", path: `${OUT}/examples/Card/react/actual.png`, width: 2, height: 2 },
        { name: "diff", path: `${OUT}/examples/Card/react/diff.png`, width: 2, height: 2 },
      ],
    },
  },
];

const input = {
  root: "/p",
  out: OUT,
  pixels: "live" as const,
  update: false,
  reference: "vue",
  targets: ["react", "vue", "solid"],
  examples: [
    { id: "examples/Buttons", file: "/p/examples/Buttons.example.uf.tsx" },
    { id: "examples/Card", file: "/p/examples/Card.example.uf.tsx" },
  ],
  captures,
  errors: new Map([[cellKey("examples/Card", "solid"), "Failed to import test file"]]),
};

describe("buildReport", () => {
  it("lists every example on every target, in the run's order, with paths relative to the report", () => {
    const report = buildReport(input);
    const missing = (message: string): VisualCell => ({
      target: "solid",
      role: "follower",
      status: "failed",
      outcome: "not-captured",
      message,
      diffPixels: null,
      geometry: [],
      images: {},
    });
    const expected: VisualReport = {
      version: REPORT_VERSION,
      pixels: "live",
      update: false,
      reference: "vue",
      targets: ["react", "vue", "solid"],
      passed: false,
      examples: [
        {
          id: "examples/Buttons",
          file: "examples/Buttons.example.uf.tsx",
          cells: [
            {
              target: "react",
              role: "follower",
              status: "passed",
              outcome: "matched",
              message: "",
              diffPixels: 0,
              geometry: [],
              images: { capture: "examples/Buttons/react.png" },
            },
            {
              target: "vue",
              role: "reference",
              status: "passed",
              outcome: "published-reference",
              message: "The reference's capture is this run's expectation (live).",
              diffPixels: null,
              geometry: [],
              images: { capture: "examples/Buttons/vue.png" },
            },
            missing("The example's test on this target ended before it captured anything."),
          ],
        },
        {
          id: "examples/Card",
          file: "examples/Card.example.uf.tsx",
          cells: [
            {
              target: "react",
              role: "follower",
              status: "failed",
              outcome: "pixel-mismatch",
              message: "12 pixel(s) differ",
              diffPixels: 12,
              geometry: [{ path: "p[0]", property: "color", expected: "red", actual: "blue" }],
              images: {
                capture: "examples/Card/react.png",
                reference: "examples/Card/react/reference.png",
                actual: "examples/Card/react/actual.png",
                diff: "examples/Card/react/diff.png",
                geometry: "examples/Card/react/geometry.actual.json",
              },
            },
            {
              target: "vue",
              role: "reference",
              status: "passed",
              outcome: "published-reference",
              message: "",
              diffPixels: null,
              geometry: [],
              images: { capture: "examples/Card/vue.png" },
            },
            missing("Failed to import test file"),
          ],
        },
      ],
    };
    expect(report).toEqual(expected);
    // What report.json holds is exactly this, through JSON.
    expect(JSON.parse(JSON.stringify(report))).toEqual(expected);
  });

  it("passes only when every cell passed", () => {
    const passing = buildReport({
      ...input,
      targets: ["react", "vue"],
      examples: [input.examples[0]!],
    });
    expect(passing.passed).toBe(true);
  });

  it("fails a cell captured twice, which would mean its spec ran twice", () => {
    const twice = buildReport({
      ...input,
      targets: ["react", "vue"],
      examples: [input.examples[0]!],
      captures: [...captures, captures[1]!],
    });
    expect(twice.passed).toBe(false);
    expect(twice.examples[0]!.cells[0]).toMatchObject({
      status: "failed",
      message: "The example was captured 2 times on this target.",
    });
  });
});

describe("formatReport", () => {
  it("prints a line per example, then each failed cell's message", () => {
    expect(formatReport(buildReport(input))).toEqual([
      "✗ examples/Buttons: failed on solid (not-captured)",
      "  solid: The example's test on this target ended before it captured anything.",
      "✗ examples/Card: failed on react (pixel-mismatch), solid (not-captured)",
      "  react: 12 pixel(s) differ",
      "  solid: Failed to import test file",
    ]);
    expect(
      formatReport(
        buildReport({ ...input, targets: ["react", "vue"], examples: [input.examples[0]!] }),
      ),
    ).toEqual(["✓ examples/Buttons: passed on 2 targets"]);
  });
});
