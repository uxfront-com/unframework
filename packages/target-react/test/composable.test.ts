// The composables of the composable and shared-module cases on React (ADR-0069): each `.uf.ts`
// source compiles through `compile()` with no error, to one custom hook, which passes React
// Compiler (L3), tsgo (L4) and the lint rules, the rules of hooks among them (L5), as the
// corpus's toolchain project runs them. The components that call them wait for React's call site
// (L18). The cases wait in `tests/integration/pending/` until every target's lane has landed
// (../../codegen/test/composable-cases.ts).
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { liveReaderNames } from "../src/composable.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { packageDir, toolchainDir } from "./fixtures.ts";

const context = { toolchainDir, root: packageDir };
const scratch = join(packageDir, ".uf-tmp", `composable-${randomUUID()}`);
const cases = (await compileComposableCases("react"))
  .map((each) => ({
    ...each,
    sources: each.sources.filter(({ filename }) => filename.endsWith(".uf.ts")),
  }))
  .filter(({ sources }) => sources.length > 0);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("react composable cases", () => {
  it("finds the cases that hold a composable", () => {
    expect(cases.map(({ id }) => id)).toEqual([
      "composables/use-toggle",
      "composables/use-controllable-state",
      "composables/use-media-query",
      "composables/getter-argument",
      "composables/callback-argument",
      "semantics/composable-read-after-write",
      "semantics/composable-effect-order",
      "semantics/composable-unmount-order",
    ]);
  });

  it.each(cases)(
    "compiles $id to hooks that pass L3 to L5",
    { timeout: 60_000 },
    async ({ id, sources }) => {
      const errors = sources.flatMap(({ diagnostics }) =>
        diagnostics.filter(({ severity }) => severity === "error"),
      );
      expect(errors).toEqual([]);
      const outputs = sources.flatMap(({ outputs }) => outputs);
      expect(outputs.map(({ path }) => path)).toEqual(
        sources.map(({ filename }) => `${filename.slice(filename.lastIndexOf("/") + 1, -6)}.ts`),
      );
      const directory = join(scratch, id);
      mkdirSync(directory, { recursive: true });
      const files = outputs.map(({ path, contents }) => {
        const absolute = join(directory, path);
        writeFileSync(absolute, contents);
        return { path: absolute, contents };
      });
      const compiled = await toolchain.frameworkCompile(files, context);
      for (const { path } of files)
        expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
      const paths = files.map(({ path }) => path);
      const checked = await toolchain.typecheck(paths, context);
      for (const path of paths) expect(checked.get(path) ?? [], path).toEqual([]);
      const linted = await toolchain.lint(paths, context);
      for (const [path, messages] of linted) expect(messages, path).toEqual([]);
    },
  );
});

describe("react composable hooks", () => {
  const hook = (id: string) =>
    cases.find((each) => each.id === id)!.sources[0]!.outputs[0]!.contents;

  it("returns each state with its live reader over the mirror, and stable functions", () => {
    const output = hook("composables/use-toggle");
    expect(output).toContain("const [currentOn] = useState(() => () => onRef.current);");
    expect(output).toContain("const [toggle] = useState(() => () => {");
    expect(output).toContain("return { on, currentOn, toggle, close };");
  });

  it("reads getter arguments through mirrors in a returned derived value's live getter", () => {
    const output = hook("composables/getter-argument");
    expect(output).toContain(
      "const total = useMemo(() => price() * quantity(), [price, quantity]);",
    );
    expect(output).toContain(
      "const [currentTotal] = useState(() => () => priceRef.current() * quantityRef.current());",
    );
  });

  it("calls a callback argument through its mirror, and reads a value argument as passed", () => {
    const output = hook("composables/callback-argument");
    expect(output).toContain("onLimitRef.current = onLimit;");
    expect(output).toContain(
      "if (countRef.current === limit) onLimitRef.current(countRef.current);",
    );
  });
});

describe("react composable live readers", () => {
  it("names each state's and derived value's reader, past every member's name", () => {
    const readers = liveReaderNames([
      { name: "on", kind: "state" },
      { name: "currentOn", kind: "function" },
      { name: "total", kind: "derived" },
      { name: "toggle", kind: "function" },
      { name: "step", kind: "constant" },
    ]);
    expect([...readers]).toEqual([
      ["on", "currentOn_1"],
      ["total", "currentTotal"],
    ]);
  });
});
