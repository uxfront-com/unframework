// The composable and shared-module cases on Astro (ADR-0069, ADR-0070): each compiles through
// `compile()` with no error, and its outputs, the composables' static `.ts` modules and the
// copied `.ts` modules among them, pass Astro's compiler (L3), astro check (L4) and the lint
// rules (L5) as the corpus's toolchain project runs them. The cases wait in
// `tests/integration/pending/` until every target's lane has landed
// (../../codegen/test/composable-cases.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { scratchDirectory } from "./astro.ts";
import { toolchainDir } from "./workspace.ts";

const scratch = scratchDirectory("composable");
afterAll(() => scratch.remove());

const cases = await compileComposableCases("astro");

describe("astro composable cases", () => {
  it.each(cases)(
    "compiles $id and passes L3 to L5",
    { timeout: 60_000 },
    async ({ id, sources }) => {
      const errors = sources.flatMap(({ diagnostics }) =>
        diagnostics.filter(({ severity }) => severity === "error"),
      );
      expect(errors).toEqual([]);
      // Two sources that import one module each copy it, the same.
      const files = new Map<string, string>();
      for (const output of sources.flatMap(({ outputs }) => outputs)) {
        expect(files.get(output.path) ?? output.contents, output.path).toBe(output.contents);
        files.set(output.path, output.contents);
      }
      expect([...files.keys()].some((path) => path.endsWith(".astro"))).toBe(true);
      const directory = join(scratch.path, id);
      mkdirSync(directory, { recursive: true });
      const written = [...files].map(([path, contents]) => {
        const file = join(directory, path);
        writeFileSync(file, contents);
        return { path: file, contents };
      });
      const paths = written.map(({ path }) => path);
      const context = { toolchainDir, root: directory };
      const compiled = await toolchain.frameworkCompile(written, context);
      for (const path of paths)
        expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
      const checked = await toolchain.typecheck(paths, context);
      for (const path of paths) expect(checked.get(path) ?? [], path).toEqual([]);
      const linted = await toolchain.lint(paths, context);
      for (const [path, messages] of linted) expect(messages, path).toEqual([]);
    },
  );
});
