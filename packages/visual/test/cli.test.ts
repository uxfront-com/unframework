// `unframework visual`'s arguments, and the refusals a run makes before it starts anything.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BASELINE_ENVIRONMENT } from "@unframework.dev/testing/node";
import { describe, expect, it } from "vitest";

import { parseVisualArguments, run } from "../src/cli.ts";
import { discoverExamples } from "../src/examples.ts";
import {
  checkRunDirectory,
  runVisual,
  RUN_MARKER,
  VisualUsageError,
  writeSpecs,
} from "../src/run.ts";

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "uf-visual-cli-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const CONFIG = 'export default { targets: ["react", "vue"] };\n';
const EXAMPLE = "export default function Hello() {\n  return <p>Hello</p>;\n}\n";

describe("parseVisualArguments", () => {
  it("reads targets, the pixel mode, --update and --out", () => {
    expect(parseVisualArguments([])).toEqual({ targets: [], update: false });
    expect(
      parseVisualArguments(["--target", "react", "--target=vue", "--baseline", "--out", "out/v"]),
    ).toEqual({ targets: ["react", "vue"], pixels: "baseline", update: false, out: "out/v" });
    expect(parseVisualArguments(["--update", "--out=x"])).toEqual({
      targets: [],
      update: true,
      out: "x",
    });
    expect(parseVisualArguments(["--live", "--live"])).toMatchObject({ pixels: "live" });
  });

  it.each([
    [["--target", "preact"], "unknown target preact"],
    [["--target"], "--target needs a value"],
    [["--target", "--live"], "--target needs a value"],
    [["--out="], "--out needs a value"],
    [["--out", "a", "--out", "b"], "--out is given twice"],
    [["--baseline", "--live"], "--baseline and --live exclude each other"],
    [["--update", "--live"], "--update writes the committed baselines"],
    [["--watch"], 'unknown argument "--watch"'],
  ])("refuses %j", (args, message) => {
    expect(() => parseVisualArguments(args)).toThrow(VisualUsageError);
    expect(() => parseVisualArguments(args)).toThrow(message);
  });
});

describe("runVisual's refusals", () => {
  it("refuses --update outside the baseline environment, before it writes anything", async () => {
    const root = project({
      "unframework.config.ts": CONFIG,
      "examples/Hello.example.uf.tsx": EXAMPLE,
    });
    for (const env of [{}, { UF_BASELINE_ENVIRONMENT: "my laptop" }]) {
      await expect(runVisual({ root, update: true, env })).rejects.toThrow(
        `--update writes the committed Linux baselines, which only ${BASELINE_ENVIRONMENT} writes`,
      );
    }
    await expect(runVisual({ root, update: true, pixels: "live", env: {} })).rejects.toThrow(
      "drop --live",
    );
    expect(existsSync(join(root, ".unframework"))).toBe(false);
  });

  it("refuses a project with no example", async () => {
    const root = project({ "unframework.config.ts": CONFIG, "src/Hello.uf.tsx": EXAMPLE });
    await expect(runVisual({ root, env: {} })).rejects.toThrow("No example under");
  });

  it("stops at UF7011 with exit 1, and reports it at the props", async () => {
    const root = project({
      "unframework.config.ts": CONFIG,
      "examples/Hello.example.uf.tsx":
        "export default function Hello({ who }: { who: string }) {\n  return <p>Hello {who}</p>;\n}\n",
    });
    let stderr = "";
    const code = await run([], {
      cwd: root,
      stdout: () => {},
      stderr: (text) => void (stderr += text),
    });
    expect(code).toBe(1);
    expect(stderr).toBe(
      "examples/Hello.example.uf.tsx:1:31 error UF7011: The example Hello declares props, which no target is given: an example renders with none.\n",
    );
    expect(existsSync(join(root, ".unframework"))).toBe(false);
  });
});

describe("checkRunDirectory", () => {
  it("accepts a new directory, an empty one, and one an earlier run marked", () => {
    const root = project({ "a/x.txt": "", "marked/old.png": "", [`marked/${RUN_MARKER}`]: "" });
    mkdirSync(join(root, "empty"));
    for (const out of ["new", "empty", "marked"]) {
      expect(() => checkRunDirectory(root, join(root, out))).not.toThrow();
    }
  });

  it("refuses the project, a directory above it, and one with files of its own", () => {
    const root = project({ "a/x.txt": "" });
    expect(() => checkRunDirectory(root, root)).toThrow("holds the project");
    expect(() => checkRunDirectory(root, dirname(root))).toThrow("holds the project");
    expect(() => checkRunDirectory(root, join(root, "a"))).toThrow("no earlier run wrote it");
  });
});

describe("writeSpecs", () => {
  it("writes one case per example, whose case.json names the example as its main source", () => {
    const root = project({
      "examples/Hello.example.uf.tsx": EXAMPLE,
      "examples/nested/Deep.example.uf.tsx": EXAMPLE,
      ".unframework/specs/stale/visual.test.ts": "",
    });
    const specs = writeSpecs(root, discoverExamples({ root }));
    expect([...specs.keys()]).toEqual(["examples/Hello", "examples/nested/Deep"]);
    const dir = join(root, ".unframework/specs/examples/nested/Deep");
    expect(specs.get("examples/nested/Deep")).toBe(join(dir, "visual.test.ts"));
    expect(JSON.parse(readFileSync(join(dir, "case.json"), "utf8"))).toEqual({
      main: "../../../../../examples/nested/Deep.example.uf.tsx",
    });
    const spec = readFileSync(join(dir, "visual.test.ts"), "utf8");
    expect(spec).toContain(
      'import Example from "../../../../../examples/nested/Deep.example.uf.tsx";',
    );
    expect(spec).toContain(
      'captureExample("examples/nested/Deep", ".unframework/specs/examples/nested/Deep", Example);',
    );
    expect(existsSync(join(root, ".unframework/specs/stale"))).toBe(false);
  });
});
