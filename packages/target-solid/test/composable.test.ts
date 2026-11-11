// The composable and shared-module cases on Solid (ADR-0069, ADR-0070): each compiles through
// `compile()` with no error, and its outputs, the composables' modules and the copied `.ts`
// modules among them, pass babel-preset-solid (L3), tsgo (L4) and the lint rules, eslint-plugin-
// solid included (L5), as the corpus's toolchain project runs them. The cases wait in
// `tests/integration/pending/` until every target's lane has landed
// (../../codegen/test/composable-cases.ts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ToolchainContext } from "@unframework.dev/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

const context: ToolchainContext = { toolchainDir, root: packageDir };
const cases = await compileComposableCases("solid");

// In the package, so the outputs' `solid-js` imports resolve from its node_modules.
mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "composable-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("solid composable cases", () => {
  it.each(cases)("compiles $id and passes L3 to L5", { timeout: 60_000 }, async (each) => {
    const errors = each.sources.flatMap(({ diagnostics }) =>
      diagnostics.filter(({ severity }) => severity === "error"),
    );
    expect(errors).toEqual([]);
    // Two sources that import one module each copy it, the same.
    const files = new Map<string, string>();
    for (const output of each.sources.flatMap(({ outputs }) => outputs)) {
      expect(files.get(output.path) ?? output.contents, output.path).toBe(output.contents);
      files.set(output.path, output.contents);
    }
    expect([...files.keys()].some((path) => path.endsWith(".tsx"))).toBe(true);
    const written = [...files].map(([path, contents]) => {
      const file = join(scratch, each.id, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, contents);
      return { path: file, contents };
    });
    const paths = written.map(({ path }) => path);
    const compiled = await toolchain.frameworkCompile(written, context);
    for (const path of paths)
      expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
    const checked = await toolchain.typecheck(paths, context);
    for (const path of paths) expect(checked.get(path) ?? [], path).toEqual([]);
    const linted = await toolchain.lint(paths, context);
    for (const [path, messages] of linted) expect(messages, path).toEqual([]);
  });
});
