// Imports that pass through (plan §4.4, ADR-0064): an import whose specifier starts with a
// `passThrough` prefix (`virtual:` by default) passes through into the IR, as named imports a
// `class` calls or a side-effect import, whatever the engine; any other use of it is UF5006.
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { analyze } from "../src/index.ts";
import { codes, problems, run } from "./helpers.ts";

const RECIPES = 'import { button } from "virtual:engine";\n';
const SHEET = 'import "virtual:engine.css";\n';

/** A component that renders `jsx`, with `size` as a prop. */
function component(jsx: string, imports = RECIPES): string {
  return `${imports}export default function B({ size }: { size?: "sm" | "lg" }) {\n  return ${jsx};\n}\n`;
}

describe("imports that pass through", () => {
  it("passes a name called in a `class`, and a side-effect import, through", () => {
    const source = component("<p class={button({ size })}>Hi</p>", RECIPES + SHEET);
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.passThroughImports).toEqual([
      {
        specifier: "virtual:engine",
        names: [{ imported: "button", local: "button", span: { start: 9, end: 15 } }],
        span: { start: 0, end: RECIPES.length - 1 },
      },
      {
        specifier: "virtual:engine.css",
        names: [],
        span: { start: RECIPES.length, end: RECIPES.length + SHEET.length - 1 },
      },
    ]);
    const [item] =
      module!.components[0]!.render.kind === "Element"
        ? module!.components[0]!.render.attributes
        : [];
    expect(JSON.stringify(item)).toContain('"kind":"Import","name":"button"');
  });

  it("keeps a recipe's local name, and accepts it in a `class` array and conditional", () => {
    const imports = 'import { button as cta } from "virtual:engine";\n';
    const source = component(
      '<p class={["note", size ? cta({ size }) : undefined]}>Hi</p>',
      imports,
    );
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.passThroughImports![0]!.names[0]).toMatchObject({
      imported: "button",
      local: "cta",
    });
  });

  it.each([
    ["a default import", 'import recipes from "virtual:engine";\n', "recipes"],
    ["a namespace import", 'import * as recipes from "virtual:engine";\n', "* as recipes"],
    [
      "a type-only name",
      'import { type ButtonProps } from "virtual:engine";\n',
      "type ButtonProps",
    ],
  ])("reports %s (UF5006)", (_, imports, reported) => {
    const source = component("<p>Hi</p>", imports);
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF5006 ${reported}`]);
  });

  it.each([
    ["outside a `class`", "<p title={button()}>Hi</p>"],
    ["in a toggle's condition", "<p class={{ on: button() }}>Hi</p>"],
    ["as a value", "<p class={String(button)}>Hi</p>"],
    ["through `?.`", "<p class={button?.()}>Hi</p>"],
  ])("reports a recipe used %s (UF5006), once", (_, jsx) => {
    const source = component(jsx);
    const { module, diagnostics } = run(source);
    expect(module?.components ?? []).toEqual([]);
    expect(problems(source, diagnostics)).toEqual(["UF5006 button"]);
  });

  it("reports a recipe that setup code reads (UF5006)", () => {
    const source = `${RECIPES}export default function B() {\n  const names = button();\n  return <p class={names}>Hi</p>;\n}\n`;
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toContain("UF5006 button");
  });

  it("reports a recipe nothing reads (UF5006): its import would reach every output unused", () => {
    const source = component("<p>Hi</p>");
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual(["UF5006 button"]);
  });

  it.each([
    ["`$btn`", 'import { $btn } from "virtual:engine";\n', "$btn"],
    ["`btn$`", 'import { btn$ } from "virtual:engine";\n', "btn$"],
    ["`ngButton`", 'import { button as ngButton } from "virtual:engine";\n', "ngButton"],
  ])("reports a recipe named %s (UF2003): no output can declare it", (_, imports, reported) => {
    const source = component("<p>Hi</p>", imports);
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF2003 ${reported}`]);
  });

  it.each([
    ["a string name", 'import { "my-button" as button } from "virtual:engine";\n', '"my-button"'],
    [
      "the default export by name",
      'import { default as button } from "virtual:engine";\n',
      "default",
    ],
  ])("reports %s of the recipes (UF5006)", (_, imports, reported) => {
    const source = component("<p>Hi</p>", imports);
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF5006 ${reported}`]);
  });

  it("reports a recipe named like a prop of the object form (UF2003)", () => {
    const source = `${RECIPES}export default function B(props: { button?: string }) {\n  return <p class={button()}><b class={button()}>{props.button}</b></p>;\n}\n`;
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual(["UF2003 button"]);
  });

  it("passes a side-effect import of any module the prefixes match, whatever its suffix", () => {
    const imports =
      'import "virtual:engine";\nimport "virtual:engine/setup";\nimport "virtual:theme.css";\n';
    const { module, diagnostics } = run(component("<p>Hi</p>", imports));
    expect(diagnostics).toEqual([]);
    expect(module!.passThroughImports!.map(({ specifier }) => specifier)).toEqual([
      "virtual:engine",
      "virtual:engine/setup",
      "virtual:theme.css",
    ]);
  });
});

describe("the passThrough option", () => {
  /** Analyses `source` with the given prefixes. */
  function withPrefixes(source: string, passThrough?: readonly string[]) {
    return analyze(parseModule("B.uf.tsx", source), passThrough ? { passThrough } : {});
  }

  it("passes `virtual:` imports by default", () => {
    const { diagnostics } = withPrefixes(component("<p class={button()}>Hi</p>"));
    expect(diagnostics).toEqual([]);
  });

  it("replaces the default: another prefix passes, and `virtual:` keeps today's codes", () => {
    const styled = 'import { css } from "styled-system/css";\n';
    const passed = withPrefixes(component("<p class={css()}>Hi</p>", styled), ["styled-system/"]);
    expect(passed.diagnostics).toEqual([]);
    expect(passed.module!.passThroughImports![0]!.specifier).toBe("styled-system/css");
    expect(
      codes(withPrefixes(component("<p class={button()}>Hi</p>"), ["styled-system/"]).diagnostics),
    ).toContain("UF1002");
    const scss = withPrefixes(component("<p>Hi</p>", 'import "virtual:x.scss";\n'), [
      "styled-system/",
    ]);
    expect(codes(scss.diagnostics)).toEqual(["UF5003"]);
  });

  it.each([
    ["the authoring API", 'import { ref } from "unframework";\n', "unframework", []],
    ["a framework", 'import { ref } from "vue";\n', "vue", ["UF1201"]],
    ["a component", 'import Child from "virtual:Child.uf.tsx";\n', "virtual:", ["UF1202"]],
    ["a relative module", 'import "./theme.css";\n', ".", ["UF5005"]],
  ])("never passes %s through, whatever the prefixes", (_, imports, prefix, expected) => {
    // A relative prefix is the compiler's to reject: the analyser still never matches one.
    const { module, diagnostics } = withPrefixes(component("<p>Hi</p>", imports), [prefix]);
    expect(module?.passThroughImports).toBeUndefined();
    expect(codes(diagnostics)).toEqual(expected);
  });
});
