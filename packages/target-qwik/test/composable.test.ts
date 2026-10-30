// The composables of the composable and shared-module cases on Qwik (ADR-0069): each `.uf.ts`
// source compiles through `compile()` with no error, to one `use*` hook, which passes the real
// optimizer (L3), tsgo (L4) and the lint rules, eslint-plugin-qwik's type-aware ones among them
// (L5), as the corpus's toolchain project runs them. The components that call them wait for
// Qwik's call site (L27). The cases wait in `tests/integration/pending/` until every target's lane
// has landed (../../codegen/test/composable-cases.ts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ImportSet } from "@unframework/codegen";
import { createComposableParameter, createTypeText } from "@unframework/ir";
import type { ComposableParameter, ComposableParameterKind } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { compileComposableCases } from "../../codegen/test/composable-cases.ts";
import { parameterCode, readGetters } from "../src/composable.ts";
import { OutputNames } from "../src/plan.ts";
import { toolchain } from "../src/toolchain/index.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context = { toolchainDir: join(repo, "tests/toolchains/qwik"), root: packageDir };
// Scratch files live inside this package, so `@qwik.dev/core` resolves from them.
mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "composable-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const cases = (await compileComposableCases("qwik"))
  .map((each) => ({
    ...each,
    sources: each.sources.filter(({ filename }) => filename.endsWith(".uf.ts")),
  }))
  .filter(({ sources }) => sources.length > 0);

describe("qwik composable cases", () => {
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
      const emitted = sources.flatMap(({ outputs }) => outputs);
      expect(emitted.map(({ path }) => path)).toEqual(
        sources.map(({ filename }) => `${filename.slice(filename.lastIndexOf("/") + 1, -6)}.ts`),
      );
      const directory = join(scratch, id);
      mkdirSync(directory, { recursive: true });
      const files = emitted.map(({ path, contents }) => {
        const absolute = join(directory, path);
        writeFileSync(absolute, contents);
        return { path: absolute, contents };
      });
      const compiled = await toolchain.frameworkCompile(files, context);
      for (const { path } of files) {
        expect(compiled.get(path), path).toEqual({ errors: [], warnings: [] });
      }
      const paths = files.map(({ path }) => path);
      const checked = await toolchain.typecheck(paths, context);
      for (const path of paths) expect(checked.get(path) ?? [], path).toEqual([]);
      const linted = await toolchain.lint(paths, context);
      for (const [path, messages] of linted) expect(messages, path).toEqual([]);
    },
  );
});

/** The hook a case's composable compiles to. */
function hook(id: string): string {
  return cases.find((each) => each.id === id)!.sources[0]!.outputs[0]!.contents;
}

describe("qwik composable hooks", () => {
  it("returns its signals as they are, and its functions as `$()` QRLs", () => {
    const output = hook("composables/use-toggle");
    expect(output).toContain("export function useToggle(initial: boolean) {");
    expect(output).toContain("const on = useSignal(initial);");
    expect(output).toContain("const toggle = $(() => {");
    expect(output).toContain("return { on, toggle, close };");
  });

  it("takes a getter argument as the signal its caller computes, read through `.value`", () => {
    const output = hook("composables/getter-argument");
    expect(output).toContain(
      "export function useTotal(price: ReadonlySignal<number>, quantity: ReadonlySignal<number>) {",
    );
    expect(output).toContain("const total = useComputed$(() => price.value * quantity.value);");
  });

  it("takes a callback argument as a QRL, which a call that returns nothing leaves to run", () => {
    const output = hook("composables/callback-argument");
    expect(output).toContain("onLimit: QRL<(count: number) => void>");
    expect(output).toContain("if (count.value === limit) void onLimit(count.value);");
  });

  it("keeps its type parameters, which its parameters' forms carry", () => {
    const output = hook("composables/use-controllable-state");
    expect(output).toContain("export function useControllableState<T>(");
    expect(output).toContain("value: ReadonlySignal<T | undefined>,");
    expect(output).toContain("onChange: QRL<(next: T) => void>,");
  });

  it("reads a getter argument as its signal in a derived value and in a hook", () => {
    const output = hook("semantics/composable-unmount-order");
    expect(output).toContain("const title = useComputed$(() => `Panel ${name.value}`);");
    expect(output).toContain("report(`${name.value} closed`);");
  });
});

/** A composable's parameter of a kind, with its type as written. */
function parameter(
  name: string,
  kind: ComposableParameterKind,
  type: string,
  optional = false,
): ComposableParameter {
  const span = { start: 0, end: type.length };
  return createComposableParameter(
    name,
    kind,
    createTypeText(type, span),
    `${name}@0`,
    span,
    optional,
  );
}

describe("qwik composable parameters", () => {
  it("declares a value as written, a getter as a signal and a callback as a QRL", () => {
    const names = new OutputNames(new ImportSet(new Set()));
    expect(parameterCode(parameter("initial", "value", "boolean"), names)).toBe("initial: boolean");
    expect(parameterCode(parameter("price", "getter", "() => number | undefined"), names)).toBe(
      "price: ReadonlySignal<number | undefined>",
    );
    expect(parameterCode(parameter("pick", "getter", "<T>() => T", true), names)).toBe(
      "pick?: ReadonlySignal<ReturnType<<T>() => T>>",
    );
    expect(parameterCode(parameter("onLimit", "callback", "(count: number) => void"), names)).toBe(
      "onLimit: QRL<(count: number) => void>",
    );
  });

  it("reads a getter's signal where code calls it, an optional call included", () => {
    const getters = new Set(["price"]);
    expect(readGetters("price() * 2", "expression", getters)).toBe("price.value * 2");
    expect(readGetters("price?.() ?? 0", "expression", getters)).toBe("price?.value ?? 0");
    expect(
      readGetters("{ const total = price(); log(total, prices()); }", "statements", getters),
    ).toBe("{ const total = price.value; log(total, prices()); }");
  });
});
