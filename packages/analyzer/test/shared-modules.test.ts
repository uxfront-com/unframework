import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

// Shared modules and module-level declarations (ADR-0070): a component reads values and types from
// relative `.ts` modules, as the compiler's resolver read them, and its module's top-level `const`
// declarations, each through a read-only binding of its own.
import type { SharedModule } from "../src/index.ts";
import { moduleSpecifiers, sharedModuleImports } from "../src/index.ts";
import { codes, problems, run } from "./helpers.ts";

/** The shared modules a test's resolver read, by specifier. */
function modules(
  entries: Record<string, SharedModule | undefined>,
): ReadonlyMap<string, SharedModule | undefined> {
  return new Map(Object.entries(entries));
}

const TOKENS = modules({ "./tokens": { file: "tokens.ts" } });

describe("module-level constants", () => {
  it("reads a constant in a template and in setup code, through a binding of the component's", () => {
    const source = [
      "const SIZES = { sm: 8, md: 12 } as const;",
      "const UNUSED = 1;",
      "export function A() {",
      "  const gap = SIZES.md * 2;",
      "  return <p data-gap={gap}>{SIZES.sm}</p>;",
      "}",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.constants).toEqual([
      {
        name: "SIZES",
        binding: "SIZES@6",
        value: { code: "{ sm: 8, md: 12 } as const", span: { start: 14, end: 40 }, refs: [] },
        span: { start: 0, end: 41 },
      },
    ]);
    const bindings = module!.components[0]!.bindings.filter((each) => each.kind === "moduleConst");
    expect(bindings).toEqual([
      { id: "SIZES@6", name: "SIZES", kind: "moduleConst", span: { start: 6, end: 11 } },
    ]);
    expect(JSON.stringify(module!.components[0]!.render)).toContain('"binding":"SIZES@6"');
    expect(JSON.stringify(module!.components[0]!.setup)).toContain('"binding":"SIZES@6"');
  });

  it("keeps the constants a read constant reads, its annotation and its globals, in source order", () => {
    const source = [
      "const BASE = 4;",
      "const LABEL: string = String(BASE * 2);",
      "export function A() { return <p>{LABEL}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(
      module!.constants!.map(({ name, type, value }) => [name, type?.code, value.refs]),
    ).toEqual([
      ["BASE", undefined, []],
      [
        "LABEL",
        "string",
        [
          { kind: "Global", name: "String", span: { start: 38, end: 44 } },
          { kind: "Binding", binding: "BASE@6", span: { start: 45, end: 49 } },
        ],
      ],
    ]);
  });

  it("reads a constant function, called, in a template", () => {
    const source = [
      "const double = (value: number) => value * 2;",
      "export function A({ count }: { count: number }) { return <p>{double(count)}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(JSON.stringify(module!.components[0]!.render)).toContain(
      '"binding":"double@6","span":{"start":',
    );
    expect(JSON.stringify(module!.components[0]!.render)).toContain('"call":true');
  });

  it("lets a getter call a local function that reads only a constant (UF2014)", () => {
    const source = [
      'import { computed, ref } from "unframework";',
      "const STEP = 2;",
      "export function A() {",
      "  const count = ref(0);",
      "  function step() { return STEP; }",
      "  const next = computed(() => count.value + step());",
      "  return <p>{next.value}</p>;",
      "}",
    ].join("\n");
    expect(run(source).diagnostics).toEqual([]);
  });

  it.each([
    ["a `let`", "let max = 3;\n", "let max = 3;"],
    ["a `const` of two constants", "const a = 1, b = 2;\n", "const a = 1, b = 2;"],
    ["a destructured `const`", "const { max } = { max: 3 };\n", "{ max }"],
    ["an exported `const`", "export const max = 3;\n", "export const max = 3;"],
  ])("reports %s (UF1002)", (_, before, reported) => {
    const source = `${before}export function A() { return <p>Hi</p>; }`;
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${reported}`]);
  });

  it("reports what a constant may not read: a global it cannot, and itself", () => {
    const source = [
      "const NOW = Date.now();",
      "const loop = (n: number): number => (n ? loop(n - 1) : 0);",
      "export function A() { return <p>{NOW}{loop(1)}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual(["UF3020 Date", "UF1002 loop"]);
  });

  it("reports a write of a constant (UF2011), and a change in place (UF2004)", () => {
    const source = [
      "const SIZES = { sm: 8 };",
      "const LIST = [1];",
      "export function A() {",
      "  function reset() { SIZES = { sm: 1 }; SIZES.sm = 2; LIST.push(3); }",
      '  return <button type="button" onClick={reset}>{SIZES.sm}</button>;',
      "}",
    ].join("\n");
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF2011", "UF2004", "UF2004"]);
    expect(diagnostics[1]!.message).toContain("`SIZES`, a constant the module declares,");
  });
});

describe("imports of shared modules", () => {
  it("lists the specifiers a module imports shared modules by, values or types, each once", () => {
    const parsed = parseModule(
      "A.uf.tsx",
      [
        'import { a } from "./tokens";',
        'import type { T } from "./types.ts";',
        'import { b } from "./tokens";',
        'import F from "./F.uf.tsx";',
        'import { useX } from "./useX.uf.ts";',
        'import "./A.css";',
        'import { c } from "pkg";',
      ].join("\n"),
    );
    expect(sharedModuleImports(parsed)).toEqual(["./tokens", "./types.ts"]);
    const shared = parseModule(
      "tokens.ts",
      [
        'import { a } from "./a.ts";',
        'export { b } from "pkg";',
        'export * from "react";',
        "export const c = 1;",
      ].join("\n"),
    );
    expect(moduleSpecifiers(shared)).toEqual(["./a.ts", "pkg", "react"]);
  });

  it("reads a shared module's values through `import` bindings, and re-imports its types", () => {
    const source = [
      'import { sizes, format as fmt, type Size } from "./tokens";',
      "export function A({ size }: { size: Size }) {",
      "  return <p>{fmt(sizes[size])}</p>;",
      "}",
    ].join("\n");
    const typed = run(source.replace("{ size: Size }", '{ size: "sm" }'), "Test.uf.tsx", {
      modules: TOKENS,
    });
    expect(typed.diagnostics).toEqual([]);
    expect(typed.module!.moduleImports).toEqual([
      {
        specifier: "./tokens",
        file: "tokens.ts",
        names: [
          { imported: "sizes", local: "sizes", span: { start: 9, end: 14 } },
          { imported: "format", local: "fmt", span: { start: 16, end: 29 } },
        ],
        span: { start: 0, end: 59 },
      },
    ]);
    expect(typed.module!.typeImports).toEqual([
      {
        specifier: "./tokens",
        names: [{ imported: "Size", local: "Size", span: { start: 31, end: 40 } }],
        span: { start: 0, end: 59 },
      },
    ]);
    expect(typed.module!.components[0]!.bindings.filter(({ kind }) => kind === "import")).toEqual([
      { id: "sizes@9", name: "sizes", kind: "import", span: { start: 9, end: 14 } },
      { id: "fmt@26", name: "fmt", kind: "import", span: { start: 26, end: 29 } },
    ]);
    const render = JSON.stringify(typed.module!.components[0]!.render);
    expect(render).toContain('{"kind":"Binding","binding":"fmt@26","span":');
    expect(render).toContain('"call":true');
  });

  it("reports a value import the resolver could not read, or without a resolver (UF1202)", () => {
    const source =
      'import { sizes } from "./tokens";\nexport function A() { return <p>{sizes}</p>; }';
    for (const options of [{}, { modules: modules({ "./tokens": undefined }) }]) {
      const { module, diagnostics } = run(source, "Test.uf.tsx", options);
      expect(module).toBeUndefined();
      expect(problems(source, diagnostics)).toEqual(['UF1202 "./tokens"']);
    }
  });

  it("leaves a type import the resolver could not read to the type oracle", () => {
    const source =
      'import type { Size } from "./types";\nexport function A() { return <p>Hi</p>; }';
    const { module, diagnostics } = run(source, "Test.uf.tsx", {
      modules: modules({ "./types": undefined }),
    });
    expect(diagnostics).toEqual([]);
    expect(module!.typeImports![0]!.specifier).toBe("./types");
  });

  it.each([
    [
      "itself",
      { file: "tokens.ts", framework: { specifier: "react", file: "tokens.ts" } },
      '"./tokens" imports "react"',
    ],
    [
      "through another module",
      { file: "tokens.ts", framework: { specifier: "unframework", file: "base.ts" } },
      '"./tokens" reaches "base.ts", which imports "unframework"',
    ],
  ])("reports a shared module that imports a framework %s (UF1204)", (_, shared, message) => {
    for (const specifiers of ["{ sizes }", "type { Size }"]) {
      const source = `import ${specifiers} from "./tokens";\nexport function A() { return <p>Hi</p>; }`;
      const { module, diagnostics } = run(source, "Test.uf.tsx", {
        modules: modules({ "./tokens": shared }),
      });
      expect(module).toBeUndefined();
      expect(problems(source, diagnostics)).toEqual(['UF1204 "./tokens"']);
      expect(diagnostics[0]!.message).toContain(message);
    }
  });

  it("reports a module the shared module reaches that the resolver could not read (UF1202)", () => {
    const source =
      'import { sizes } from "./tokens";\nexport function A() { return <p>{sizes}</p>; }';
    const { module, diagnostics } = run(source, "Test.uf.tsx", {
      modules: modules({
        "./tokens": { file: "tokens.ts", unresolved: { specifier: "./gone", file: "tokens.ts" } },
      }),
    });
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual(['UF1202 "./tokens"']);
    expect(diagnostics[0]!.message).toContain('"./tokens" imports "./gone"');
  });

  it.each([
    ["a namespace import", 'import * as tokens from "./tokens";\n', "* as tokens"],
    ["a side-effect import", 'import "./tokens";\n', 'import "./tokens";'],
  ])("reports %s of a shared module (UF1002)", (_, imports, reported) => {
    const source = `${imports}export function A() { return <p>Hi</p>; }`;
    const { module, diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${reported}`]);
  });

  // A key lives in the `.uf.tsx` module that provides it (ADR-0054): a shared module's is none.
  it("reports a value of a shared module passed to `provide` as its key (UF2032)", () => {
    const source = [
      'import { provide } from "unframework";',
      'import { ThemeKey } from "./keys";',
      "export function A() {",
      '  provide(ThemeKey, "dark");',
      "  return <p>Hi</p>;",
      "}",
    ].join("\n");
    const { diagnostics } = run(source, "Test.uf.tsx", {
      modules: modules({ "./keys": { file: "keys.ts" } }),
    });
    expect(problems(source, diagnostics)).toEqual(["UF2032 ThemeKey"]);
  });

  it("reports a write of an import (UF2011)", () => {
    const source = [
      'import { sizes } from "./tokens";',
      "export function A() {",
      "  function reset() { sizes = {}; }",
      '  return <button type="button" onClick={reset}>Reset</button>;',
      "}",
    ].join("\n");
    const { diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(problems(source, diagnostics)).toEqual(["UF2011 sizes"]);
  });

  it("reports a value of another module read as a value (UF1002)", () => {
    const source = [
      'import Field from "./Field.uf.tsx";',
      "export function A() { return <p>{String(Field)}</p>; }",
    ].join("\n");
    const { diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(problems(source, diagnostics)).toEqual(['UF1202 "./Field.uf.tsx"', "UF1002 Field"]);
    expect(diagnostics[1]!.message).toContain("reads the values of shared `.ts` modules");
  });
});
