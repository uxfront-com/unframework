import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { exportsOf, root } from "./workspace.ts";

/**
 * The public API of @unframework.dev/testing: exactly what its root entry exports (ADR-0085). A
 * project's specs import these names and nothing else, so a name added to the entry is a promise
 * to code this repository cannot see. It changes here and in the ADR, or not at all; the
 * harness's machinery goes in the `./harness` subpath.
 */
const RUNTIME: readonly string[] = [
  "allowConsole",
  "capturedConsole",
  "currentTarget",
  "describeTargets",
  "it",
  "mount",
  "mountScenario",
  "test",
];

const TYPES: readonly string[] = [
  "CaseConfig",
  "ClickOptions",
  "ComponentMountOptions",
  "ConsoleEntry",
  "NoAxeViolationsOptions",
  "NotAFunction",
  "ParityOptions",
  "PixelTolerance",
  "Props",
  "SpecOptions",
  "SpecTest",
  "SsrScenario",
  "TraceStep",
  "View",
  "ViewClock",
  "ViewOptions",
  "ViewUser",
];

const entry = join(root, "packages/testing/src/index.ts");
const adrs = join(root, "docs/adrs");

/** The names in `actual` that the list lacks, and those the list has that `actual` lacks. */
function compare(actual: readonly string[], list: readonly string[]) {
  return {
    notPublic: actual.filter((name) => !list.includes(name)).toSorted(),
    missing: list.filter((name) => !actual.includes(name)).toSorted(),
  };
}

describe("the public API of @unframework.dev/testing", () => {
  const names = exportsOf(entry);

  it("exports exactly the public runtime names from its root", () => {
    const runtime = names.filter((record) => !record.typeOnly).map((record) => record.name);
    expect(compare(runtime, RUNTIME)).toEqual({ notPublic: [], missing: [] });
  });

  it("exports exactly the public types from its root", () => {
    const types = names.filter((record) => record.typeOnly).map((record) => record.name);
    expect(compare(types, TYPES)).toEqual({ notPublic: [], missing: [] });
  });

  it("names every public name in ADR-0085", () => {
    const file = readdirSync(adrs).find((name) => name.startsWith("0085-"));
    expect(file, "ADR-0085 exists").toBeDefined();
    const adr = readFileSync(join(adrs, file!), "utf8");
    const unnamed = [...RUNTIME, ...TYPES].filter((name) => !adr.includes(`\`${name}\``));
    expect(unnamed).toEqual([]);
  });

  it("exports the harness's machinery from ./harness, not the root", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "packages/testing/package.json"), "utf8"),
    ) as { exports: Record<string, string>; publishConfig: { exports: Record<string, unknown> } };
    expect(manifest.exports["./harness"]).toBe("./src/internal.ts");
    expect(manifest.publishConfig.exports["./harness"]).toEqual({
      types: "./dist/internal.d.ts",
      default: "./dist/internal.js",
    });
    const harness = exportsOf(join(root, "packages/testing/src/internal.ts")).map(
      (record) => record.name,
    );
    expect(harness).toEqual(expect.arrayContaining(["registerTarget", "cleanup", "LAYERS"]));
    expect(harness.filter((name) => RUNTIME.includes(name) || TYPES.includes(name))).toEqual([]);
  });
});
