// The composable and shared-module cases on Vue (ADR-0069, ADR-0070): each compiles through
// `compile()` with no error, and its outputs, the composables' modules and the copied `.ts`
// modules among them, pass Vue's compiler (L3), vue-tsc (L4) and the lint rules (L5) as the
// corpus's toolchain project runs them. The cases wait in `tests/integration/pending/` until every
// target's lane has landed (../../codegen/test/composable-cases.ts).
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

const context = { toolchainDir, root: toolchainDir };
const cases = await compileComposableCases("vue");

afterAll(removeScratch);

describe("vue composable cases", () => {
  it.each(cases)("compiles $id and passes L3 to L5", { timeout: 60_000 }, async ({ sources }) => {
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
    expect([...files.keys()].some((path) => path.endsWith(".vue"))).toBe(true);
    const paths = writeScratch(Object.fromEntries(files));
    const compiled = await toolchain.frameworkCompile(
      [...files].map(([path, contents]) => ({ path: paths[path]!, contents })),
      context,
    );
    for (const path of Object.values(paths)) {
      expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
    }
    const checked = await toolchain.typecheck(Object.values(paths), context);
    for (const path of Object.values(paths)) expect(checked.get(path) ?? [], path).toEqual([]);
    const linted = await toolchain.lint(Object.values(paths), context);
    for (const [path, messages] of linted) expect(messages, path).toEqual([]);
  });
});
