// Styleframe's imports (plan §4.4, ADR-0064): named imports of recipes from `virtual:styleframe`
// called in a `class`, and the side-effect import `virtual:styleframe.css`, pass through into the
// IR; any other use is UF5006.
import { describe, expect, it } from "vitest";

import { problems, run } from "./helpers.ts";

const RECIPES = 'import { button } from "virtual:styleframe";\n';
const SHEET = 'import "virtual:styleframe.css";\n';

/** A component that renders `jsx`, with `size` as a prop. */
function component(jsx: string, imports = RECIPES): string {
  return `${imports}export default function B({ size }: { size?: "sm" | "lg" }) {\n  return ${jsx};\n}\n`;
}

describe("Styleframe's imports", () => {
  it("passes a recipe called in a `class`, and the stylesheet, through", () => {
    const source = component("<p class={button({ size })}>Hi</p>", RECIPES + SHEET);
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.passThroughImports).toEqual([
      {
        specifier: "virtual:styleframe",
        names: [{ imported: "button", local: "button", span: { start: 9, end: 15 } }],
        span: { start: 0, end: RECIPES.length - 1 },
      },
      {
        specifier: "virtual:styleframe.css",
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
    const imports = 'import { button as cta } from "virtual:styleframe";\n';
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
    ["a default import", 'import recipes from "virtual:styleframe";\n', "recipes"],
    ["a namespace import", 'import * as recipes from "virtual:styleframe";\n', "* as recipes"],
    [
      "a type-only name",
      'import { type ButtonProps } from "virtual:styleframe";\n',
      "type ButtonProps",
    ],
    [
      "a side-effect import of the recipes",
      'import "virtual:styleframe";\n',
      'import "virtual:styleframe";',
    ],
    [
      "a name from the stylesheet",
      'import css from "virtual:styleframe.css";\n',
      'import css from "virtual:styleframe.css";',
    ],
    [
      "another Styleframe module",
      'import "virtual:styleframe:extension";\n',
      '"virtual:styleframe:extension"',
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
});
