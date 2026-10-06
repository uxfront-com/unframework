import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { PROBES_DIRECTORY, runProbes } from "../scripts/run-probes.ts";

/**
 * Every pinned probe. A change here is a change to what the types catch: update the README's tables
 * with it.
 */
const PINNED_PROBES = 76;

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const copies: string[] = [];

/**
 * A copy of the probe tree beside the original, so `unframework` and the base tsconfig resolve
 * exactly as they do for it. `edit` changes one file of the copy.
 */
function probeCopy(file: string, edit: (source: string) => string): string {
  const directory = mkdtempSync(join(PACKAGE, ".probes-"));
  copies.push(directory);
  cpSync(PROBES_DIRECTORY, directory, { recursive: true });
  const path = join(directory, file);
  const source = readFileSync(path, "utf8");
  const edited = edit(source);
  expect(edited, `the edit must change ${file}`).not.toBe(source);
  writeFileSync(path, edited);
  return directory;
}

afterEach(() => {
  for (const directory of copies.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** Each test runs the type checker over the probe tree: seconds on a loaded CI runner. */
describe("the probe suite", { timeout: 30_000 }, () => {
  it("passes the gate and pins every caught probe to its code", () => {
    const report = runProbes();
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.pinned).toBe(PINNED_PROBES);
  });

  it("fails the gate when a caught mistake stops being caught", () => {
    const directory = probeCopy("caught/intrinsic-elements.uf.tsx", (source) =>
      source.replace('return <div clas="x" />;', 'return <div class="x" />;'),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    expect(report.problems).toContainEqual(
      expect.stringMatching(
        /^gate: caught\/intrinsic-elements\.uf\.tsx\(\d+,\d+\): error TS2578: Unused '@ts-expect-error' directive\./,
      ),
    );
  });

  it("fails the gate on a false error in legitimate code", () => {
    const directory = probeCopy("allowed/intrinsics.uf.tsx", (source) =>
      source.replace('<div class="a" />', '<div class="a" tabindex={{}} />'),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    expect(report.problems).toContainEqual(
      expect.stringMatching(/^gate: allowed\/intrinsics\.uf\.tsx\(\d+,\d+\): error TS2322:/),
    );
  });

  it("fails the pin when a mistake is still caught, but with another code", () => {
    const directory = probeCopy("caught/intrinsic-elements.uf.tsx", (source) =>
      source.replace("@ts-expect-error TS2322 `clas`", "@ts-expect-error TS2345 `clas`"),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    expect(report.pinned).toBe(PINNED_PROBES - 1);
    expect(report.problems).toEqual([
      expect.stringMatching(
        /^pin: caught\/intrinsic-elements\.uf\.tsx:\d+: expected TS2345, got TS2322 \(\/\/ @ts-expect-error TS2345 `clas`/,
      ),
    ]);
  });

  it("fails the pin when a caught line also reports another error", () => {
    // The directive hides both errors from the gate; only the pin sees the second one.
    const directory = probeCopy("caught/intrinsic-elements.uf.tsx", (source) =>
      source.replace('return <div clas="x" />;', 'return <div clas="x" title={notDeclared} />;'),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    expect(report.pinned).toBe(PINNED_PROBES - 1);
    expect(report.problems).toEqual([
      expect.stringMatching(
        /^pin: caught\/intrinsic-elements\.uf\.tsx:\d+: expected TS2322, got TS2322, TS2304 \(\/\/ @ts-expect-error TS2322 `clas`/,
      ),
    ]);
  });

  it("requires every directive to name its code", () => {
    const directory = probeCopy("caught/intrinsic-elements.uf.tsx", (source) =>
      source.replace("@ts-expect-error TS2322 `clas`", "@ts-expect-error `clas`"),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    // The error the directive suppresses is then unaccounted for, so the pin reports it as well.
    expect(report.problems).toEqual([
      expect.stringMatching(
        /^layout: caught\/intrinsic-elements\.uf\.tsx:\d+: a directive must name its code/,
      ),
      expect.stringMatching(
        /^pin: caught\/intrinsic-elements\.uf\.tsx:\d+: unexpected TS2322 outside any directive:/,
      ),
    ]);
  });

  it("keeps directives and blanket suppressions out of the clean files", () => {
    const directory = probeCopy("allowed/intrinsics.uf.tsx", (source) =>
      source.replace(
        '      <div class="a" />',
        [
          "      {/* @ts-expect-error TS2322 hidden in allowed/ */}",
          '      <div clas="a" />',
          "      {/* @ts-ignore */}",
          '      <div clas="b" />',
        ].join("\n"),
      ),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    expect(report.problems).toEqual([
      expect.stringMatching(
        /^layout: allowed\/intrinsics\.uf\.tsx:\d+: directives belong in caught\//,
      ),
      expect.stringMatching(
        /^layout: allowed\/intrinsics\.uf\.tsx:\d+: @ts-ignore and @ts-nocheck hide errors/,
      ),
      expect.stringMatching(
        /^pin: allowed\/intrinsics\.uf\.tsx:\d+: unexpected TS2322 outside any directive:/,
      ),
    ]);
  });

  it("fails a caught/ file that pins nothing", () => {
    const directory = probeCopy("caught/element-type.uf.tsx", (source) =>
      source
        .replaceAll(/^\s*\/\/ @ts-expect-error .*\n/gm, "")
        .replace(
          /export function ComponentMustReturnJsx[\s\S]*$/,
          "export function Nothing() {\n  return <div />;\n}\n",
        ),
    );
    const report = runProbes({ directory });
    expect(report.ok).toBe(false);
    expect(report.problems).toContain(
      "layout: caught/element-type.uf.tsx pins no probe; caught/ files hold one @ts-expect-error per mistake",
    );
  });

  it("fails loudly when the checker cannot start", () => {
    expect(() => runProbes({ tsc: join(PACKAGE, "no-such-tsc") })).toThrow(
      /^probes: could not start tsc \(.*no-such-tsc\): /,
    );
  });

  it("refuses a directory that is not a probe tree", () => {
    const directory = mkdtempSync(join(tmpdir(), "uf-probes-"));
    copies.push(directory);
    expect(() => runProbes({ directory })).toThrow(
      /is not a probe tree: it has no tsconfig\.json$/,
    );
  });
});
