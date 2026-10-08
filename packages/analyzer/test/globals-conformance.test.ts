// The browser's globals `@unframework/ir` holds as data (ADR-0045), against what they stand for:
// every name lib.dom declares, in TypeScript 7's lib (the React, Solid and Qwik outputs' checker)
// and in TypeScript 6's (the Vue, Svelte, Astro and Angular toolchains'). Client code may read
// each of them, or reads it through `window`, and every target prints it as written, so a name
// the lib does not declare would fail an output's type-check, and one it declares that the IR
// leaves out would be rejected for no reason (UF3020). The IR package cannot reach those files,
// so the analyser, which reads globals by these sets, pins them. `tsc --listFilesOnly` finds
// each lib: the check never loads TypeScript's API.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  BROWSER_GLOBALS,
  CLIENT_GLOBALS,
  LIB_DOM_GLOBALS,
  PURE_GLOBALS,
  SCHEDULING_GLOBALS,
  WINDOW_MEMBER_GLOBALS,
} from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = new URL("../../../", import.meta.url);

const folder = mkdtempSync(join(tmpdir(), "uf-globals-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/** The names the `lib.dom.d.ts` a `typescript` package reads declares as values. */
function libDomGlobals(typescript: string): Set<string> {
  writeFileSync(join(folder, "probe.ts"), "export {};\n");
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { lib: ["esnext", "dom"], types: [], noEmit: true, skipLibCheck: true },
      files: ["probe.ts"],
    }),
  );
  const manifest = JSON.parse(readFileSync(typescript, "utf8")) as {
    bin: Record<string, string>;
  };
  const bin = Object.values(manifest.bin)[0]!;
  const result = spawnSync(
    process.execPath,
    [join(dirname(typescript), bin), "-p", join(folder, "tsconfig.json"), "--listFilesOnly"],
    { cwd: folder, encoding: "utf8" },
  );
  if (result.error) throw new Error(`could not start tsc: ${result.error.message}`);
  const lib = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /[\\/]lib\.dom\.d\.ts$/.test(line));
  if (!lib) throw new Error(`tsc listed no lib.dom.d.ts:\n${result.stdout}${result.stderr}`);
  const names = new Set<string>();
  const declared = /^declare (?:var|function|const|let|namespace) ([A-Za-z_$][\w$]*)/gm;
  for (const match of readFileSync(lib, "utf8").matchAll(declared)) names.add(match[1]!);
  return names;
}

/** The `typescript` package a workspace package resolves, by its manifest. */
function typescriptOf(workspace: string): string {
  return createRequire(new URL(`${workspace}/package.json`, ROOT)).resolve(
    "typescript/package.json",
  );
}

describe("the browser's globals", () => {
  it.each([
    ["TypeScript 7 (the repo's)", "packages/analyzer"],
    ["TypeScript 6 (the Vue, Svelte, Astro and Angular toolchains')", "tests/toolchains/vue"],
  ])("are every name lib.dom declares, in %s", { timeout: 60_000 }, (_, workspace) => {
    const declared = libDomGlobals(typescriptOf(workspace));
    expect(declared.size).toBeGreaterThan(900);
    expect([...LIB_DOM_GLOBALS].filter((name) => !declared.has(name))).toEqual([]);
    expect([...declared].filter((name) => !LIB_DOM_GLOBALS.has(name))).toEqual([]);
  });

  it("split lib.dom between what client code reads by name and through `window`", () => {
    const runtime = ["console", "performance", "crypto", "structuredClone"];
    for (const name of LIB_DOM_GLOBALS) {
      const kept =
        BROWSER_GLOBALS.has(name) ||
        SCHEDULING_GLOBALS.has(name) ||
        PURE_GLOBALS.has(name) ||
        runtime.includes(name);
      expect(kept !== WINDOW_MEMBER_GLOBALS.has(name), name).toBe(true);
      expect(CLIENT_GLOBALS.has(name), name).toBe(kept);
    }
    for (const name of [...BROWSER_GLOBALS, ...SCHEDULING_GLOBALS]) {
      expect(LIB_DOM_GLOBALS.has(name), name).toBe(true);
    }
  });
});
