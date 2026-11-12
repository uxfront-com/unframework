import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { sourceFiles } from "./workspace.ts";

const project = mkdtempSync(join(tmpdir(), "uf-source-files-"));
afterAll(() => rmSync(project, { recursive: true, force: true }));

function write(path: string): void {
  mkdirSync(join(project, path, ".."), { recursive: true });
  writeFileSync(join(project, path), "export {};\n");
}

describe("sourceFiles", () => {
  it("skips dot directories, node_modules and dist, like the canaries' scratch", () => {
    for (const path of [
      "a.ts",
      "nested/b.tsx",
      "nested/c.mts",
      "nested/types.d.ts",
      "nested/readme.md",
      ".canary/vue/state/counter/probe.test.ts",
      "nested/.vitest/cache.ts",
      "node_modules/pkg/index.ts",
      "nested/dist/index.ts",
    ]) {
      write(path);
    }
    expect(sourceFiles(project).map((file) => relative(project, file))).toEqual([
      "a.ts",
      join("nested", "b.tsx"),
      join("nested", "c.mts"),
    ]);
  });

  it("walks the directory it is given, even a dot directory", () => {
    expect(sourceFiles(join(project, ".canary")).map((file) => relative(project, file))).toEqual([
      join(".canary", "vue", "state", "counter", "probe.test.ts"),
    ]);
  });

  it("returns nothing for a directory that doesn't exist", () => {
    expect(sourceFiles(join(project, "missing"))).toEqual([]);
  });
});
