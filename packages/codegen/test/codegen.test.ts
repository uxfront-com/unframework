import { runInNewContext } from "node:vm";

import {
  createBinding,
  createComponent,
  createElement,
  createFor,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createStaticAttribute,
  createText,
  createTypeDeclaration,
  createTypeText,
  span,
} from "@unframework/ir";
import type { ElementNode } from "@unframework/ir";
import { transformWithOxc } from "vite";
import { describe, expect, it } from "vitest";

import {
  componentTypes,
  exportDeclaration,
  formatOutput,
  ImportSet,
  isBlockElement,
  isVoidElement,
  js,
  jsxContext,
  jsxElement,
  jsxText,
  kebabCase,
  NameScope,
  pascalCase,
  Placeholders,
  printComponentModule,
  printExpression,
  printModule,
  printProgram,
  sourceNames,
  typeDeclarationCode,
} from "../src/index.ts";
import type { JsxDialect } from "../src/index.ts";
import { expressionAt } from "./expressions.ts";

const at = { start: 0, end: 0 };

/** Prints a static element as JSX through a dialect. */
const printElement = (node: ElementNode, dialect: JsxDialect = {}) =>
  printExpression(
    jsxElement(node, jsxContext({ component: createComponent("C", node, at), dialect })),
  );

/** Text with every character outside printable ASCII as a `\uXXXX` escape, for messages. */
const escape = (text: string) =>
  text.replace(/[^\x21-\x7e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);

/** A classic JSX pragma that makes each element its text. */
const textOf = (_tag: string, _props: unknown, ...children: string[]) => children.join("");

describe("jsx", () => {
  it("writes text as JSX text with references, or as a string where JSX would change it", () => {
    const print = (value: string) =>
      printElement(createElement("p", [], [createText(value, at)], at));
    expect(print("a & b < c > d")).toBe("<p>a &amp; b &lt; c &gt; d</p>");
    expect(print("{braces}")).toBe('<p>{"{braces}"}</p>');
    expect(print("two  spaces")).toBe('<p>{"two  spaces"}</p>');
    expect(print("line\nbreak")).toBe('<p>{"line\\nbreak"}</p>');
    expect(print(" ")).toBe('<p>{" "}</p>');
    // Any whitespace but the plain space: transforms rewrite it raw, and the Qwik optimizer
    // trims even a reference that a formatter moved to a line's edge.
    expect(print("a\tb")).toBe('<p>{"a\tb"}</p>');
    expect(print("d\u00a0e")).toBe('<p>{"d\\xA0e"}</p>');
    expect(print("a\u2028b")).toBe('<p>{"a\\u2028b"}</p>');
    expect(jsxText("plain").type).toBe("JSXText");
    expect(jsxText("10\u2009km").type).toBe("JSXExpressionContainer");
    // Not JavaScript whitespace, but TypeScript's and oxc's (U+200B) and SWC's (U+0085).
    expect(jsxText("a\u200bb").type).toBe("JSXExpressionContainer");
    expect(jsxText("a\u0085b").type).toBe("JSXExpressionContainer");
  });

  it("writes raw only text that oxc keeps as written wherever a formatter puts it", async () => {
    // Every space, control and format character of the BMP: oxc (Vite's transform, so the React
    // target's) trims some of them where a line meets a line break, and a formatter may put any
    // character there. Text written raw must survive at both edges of a line. The plain space
    // is the exception formatters handle themselves: they write `{" "}` where they break a line
    // beside a space that renders.
    const candidates = Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code))
      .filter((char) => char !== " " && /[\p{White_Space}\p{Cc}\p{Cf}\p{Zs}]/u.test(char))
      .filter((char) => jsxText(`a${char}b`).type === "JSXText");
    expect(candidates.length).toBeGreaterThan(50);
    const texts = candidates.flatMap((char) => [`a${char}`, `${char}b`]);
    const source = `export default [${texts.map((text) => `<p>\n  ${text}\n</p>`).join(",\n")}];`;
    const { code } = await transformWithOxc(source, "probe.tsx", {
      jsx: { runtime: "classic", pragma: "h" },
    });
    const kept: unknown = runInNewContext(code.replace("export default", "result ="), {
      h: textOf,
    });
    if (!Array.isArray(kept) || kept.length !== texts.length) {
      throw new Error(`oxc's output is not the ${texts.length} texts: ${code.slice(0, 200)}`);
    }
    const changed = texts.flatMap((text, index) =>
      kept[index] === text ? [] : [`${escape(text)} became ${escape(String(kept[index]))}`],
    );
    expect(changed).toEqual([]);
  });

  it("maps attribute names and present attributes through the dialect", () => {
    const node = createElement(
      "label",
      [
        createStaticAttribute("for", "x", at),
        createStaticAttribute("data-on", true, at),
        createStaticAttribute("hidden", true, at),
        createStaticAttribute("title", 'say "hi"', at),
      ],
      [],
      at,
    );
    const code = printElement(node, {
      attributeName: (name) => (name === "for" ? "htmlFor" : name),
      presentAttributeValue: (name) => (name === "hidden" ? true : ""),
    });
    expect(code).toBe('<label htmlFor="x" data-on="" hidden title={"say \\"hi\\""} />');
  });

  it("quotes attribute values only when quoting keeps them exactly", () => {
    const print = (value: string) =>
      printElement(createElement("p", [createStaticAttribute("title", value, at)], [], at));
    expect(print("a  b <c> \\d")).toBe('<p title="a  b <c> \\d" />');
    expect(print("a & b")).toBe('<p title={"a & b"} />');
    expect(print("a\tb")).toBe('<p title={"a\tb"} />');
    expect(print("a\nb")).toBe('<p title={"a\\nb"} />');
  });
});

describe("printing", () => {
  it("prints a module with a blank line after the imports", () => {
    const imports = new ImportSet();
    imports.add("b", "z");
    imports.add("a", "y");
    imports.add("a", "x");
    imports.add("t", "T", { type: true });
    imports.addSideEffect("./side.css");
    const code = printModule(imports.toDeclarations(), [
      js.exportDefault(
        js.functionDeclaration("A", [], [js.returnStatement(js.stringLiteral("a"))]),
      ),
    ]);
    expect(code).toBe(
      [
        'import "./side.css";',
        'import { x, y } from "a";',
        'import { z } from "b";',
        'import type { T } from "t";',
        "",
        "export default function A() {",
        '  return "a";',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("escapes template literals", () => {
    expect(printExpression(js.templateLiteral("a `b` ${c} \\d"))).toBe("`a \\`b\\` \\${c} \\\\d`");
  });

  it("prints decorated classes", () => {
    const code = printProgram(
      js.program([
        js.classDeclaration("A", [js.decorator(js.callExpression(js.identifier("D"), []))]),
      ]),
    );
    expect(code).toContain("@D()");
  });
});

describe("formatOutput", () => {
  it("formats code with the repo's style", async () => {
    const { file, error } = await formatOutput({
      path: "A.tsx",
      contents: "export default function A(){return <p class='a'>x</p>}",
    });
    expect(error).toBeUndefined();
    expect(file.contents).toBe('export default function A() {\n  return <p class="a">x</p>;\n}\n');
  });

  it("leaves markup to the printer, with one final newline", async () => {
    // oxfmt would break the line between the inline elements, and Vue would then drop the space.
    const line = `<p>${"<a>link</a> ".repeat(12)}</p>`;
    for (const path of ["A.vue", "A.svelte", "A.astro", "a.html"]) {
      const { file } = await formatOutput({ path, contents: `<template>${line}</template>\n\n` });
      expect(file.contents).toBe(`<template>${line}</template>\n`);
    }
  });

  it("leaves a template embedded in code as printed", async () => {
    const template = `\n    <div><p>${"<b>bold</b> ".repeat(12)}</p></div>\n  `;
    const { file } = await formatOutput({
      path: "a.ts",
      contents: `@Component({template: \`${template}\`}) export default class A {}`,
    });
    expect(file.contents).toContain(`template: \`${template}\``);
  });

  it("reports code that does not parse instead of throwing", async () => {
    const outcome = await formatOutput({ path: "A.tsx", contents: "export default function (" });
    expect(outcome.error).toBeTruthy();
    expect(outcome.file.contents).toBe("export default function (");
  });

  it("is idempotent", async () => {
    const once = await formatOutput({ path: "A.tsx", contents: "const a = {b:1,c:[1,2,3]}" });
    const twice = await formatOutput(once.file);
    expect(twice.file.contents).toBe(once.file.contents);
  });
});

describe("ImportSet", () => {
  it("renames an import whose name the module declares, or another import took", () => {
    const imports = new ImportSet(["Component"]);
    expect(imports.add("@angular/core", "Component")).toBe("Component_1");
    expect(imports.add("@angular/core", "Component")).toBe("Component_1");
    expect(imports.add("other", "Component")).toBe("Component_2");
    expect(imports.add("@angular/core", "input")).toBe("input");
    expect(printProgram(js.program(imports.toDeclarations()))).toBe(
      [
        'import { Component as Component_1, input } from "@angular/core";',
        'import { Component as Component_2 } from "other";',
        "",
      ].join("\n"),
    );
  });
});

describe("NameScope", () => {
  it("claims free names deterministically, sharing the scope with the imports", () => {
    const scope = new NameScope(["props"]);
    const imports = new ImportSet(scope);
    imports.reserve("Show", "cx");
    expect(imports.claim("props")).toBe("props_1");
    expect(imports.claim("rawProps")).toBe("rawProps");
    expect(imports.add("solid-js", "Show")).toBe("Show_1");
    expect(scope.claim("cx")).toBe("cx_1");
    expect(scope.has("Show_1")).toBe(true);
    expect(scope.has("For")).toBe(false);
  });

  it("reserves every name a component's output must leave alone", () => {
    const label = createBinding("label", "prop", span(30, 35));
    const item = createBinding("item", "loopVar", span(80, 84));
    const list = createFor(
      expressionAt(60, "items.filter((props) => props.on)", ["items", "Global"]),
      item.id,
      expressionAt(90, "item.id", ["item", item]),
      createElement(
        "li",
        [],
        [createInterpolation(expressionAt(100, "label", ["label", label]), at)],
        at,
      ),
      at,
    );
    const component = createComponent(
      "Badge",
      createElement("ul", [], [list], at),
      at,
      [createProp("label", false, createTypeText("string", at), at, label.id)],
      createPropsParameter("destructured", createTypeText("BadgeProps", at), at),
      ["BadgeProps"],
      [label, item],
    );
    const module = createModule(
      "Badge.uf.tsx",
      [component],
      [],
      [
        createTypeDeclaration("BadgeProps", true, "interface BadgeProps { label: string }", at),
        createTypeDeclaration("CSSProperties", false, "type CSSProperties = { a: string }", at),
      ],
    );
    // Member and property names (`on`, `id`, `filter`) capture nothing, so they stay free.
    expect([...sourceNames(component, module)].toSorted()).toEqual(
      ["Badge", "BadgeProps", "CSSProperties", "item", "items", "label", "props"].toSorted(),
    );
  });
});

describe("html", () => {
  it("knows void and block-level elements", () => {
    expect(isVoidElement("br")).toBe(true);
    expect(isVoidElement("div")).toBe(false);
    expect(isBlockElement("p")).toBe(true);
    expect(isBlockElement("span")).toBe(false);
    expect(isBlockElement("my-element")).toBe(false);
  });
});

describe("names", () => {
  it.each([
    ["Hello", "hello"],
    ["ProfileCard", "profile-card"],
    ["HTMLView", "html-view"],
    ["Button2Group", "button2-group"],
  ])("kebab-cases %s", (input, output) => {
    expect(kebabCase(input)).toBe(output);
  });

  it("pascal-cases", () => {
    expect(pascalCase("profile-card")).toBe("ProfileCard");
    expect(pascalCase("helloWorld")).toBe("HelloWorld");
  });
});

describe("exportDeclaration", () => {
  const at = { start: 0, end: 0 };
  const fn = () => js.functionDeclaration("Hello", [], []);
  const print = (exports: Parameters<typeof exportDeclaration>[2]) =>
    printProgram(js.program(exportDeclaration("Hello", fn(), exports)));

  it("declares a lone default or same-named export in place", () => {
    expect(print([{ kind: "default", name: "default", local: "Hello", span: at }])).toBe(
      "export default function Hello() {}\n",
    );
    expect(print([{ kind: "named", name: "Hello", local: "Hello", span: at }])).toBe(
      "export function Hello() {}\n",
    );
  });

  it("keeps aliases and several exports through an export list", () => {
    expect(
      print([
        { kind: "named", name: "Greeting", local: "Hello", span: at },
        { kind: "default", name: "default", local: "Hello", span: at },
      ]),
    ).toBe("function Hello() {}\nexport { Hello as Greeting, Hello as default };\n");
  });

  it("leaves a component without exports undeclared as an export", () => {
    expect(print([])).toBe("function Hello() {}\n");
  });
});

describe("exportDeclaration of an expression", () => {
  const definition = () => js.callExpression(js.identifier("component$"), []);
  const print = (exports: Parameters<typeof exportDeclaration>[2]) =>
    printProgram(js.program(exportDeclaration("Card", definition(), exports)));

  it("exports the expression as the default, or a const under its own name", () => {
    expect(print([{ kind: "default", name: "default", local: "Card", span: at }])).toBe(
      "export default component$();\n",
    );
    expect(print([{ kind: "named", name: "Card", local: "Card", span: at }])).toBe(
      "export const Card = component$();\n",
    );
    expect(print([{ kind: "named", name: "Other", local: "Card", span: at }])).toBe(
      "const Card = component$();\nexport { Card as Other };\n",
    );
    expect(print([])).toBe("const Card = component$();\n");
  });
});

describe("type declarations", () => {
  it("copies the declarations a component's props reach, exported as the source does", () => {
    const declarations = [
      createTypeDeclaration("Tone", false, 'type Tone = "info" | "warn";', at),
      createTypeDeclaration("Unused", false, "type Unused = string;", at),
      createTypeDeclaration(
        "BadgeProps",
        true,
        "interface BadgeProps {\n  /** Shown. */\n  tone: Tone;\n}",
        at,
      ),
    ];
    const component = createComponent("Badge", createElement("p", [], [], at), at, [], undefined, [
      "Tone",
      "BadgeProps",
    ]);
    const module = createModule("Badge.uf.tsx", [component], [], declarations);
    expect(componentTypes(component, module).map(typeDeclarationCode)).toEqual([
      'type Tone = "info" | "warn";',
      "export interface BadgeProps {\n  /** Shown. */\n  tone: Tone;\n}",
    ]);
  });
});

describe("builders", () => {
  const print = (node: Parameters<typeof printExpression>[0]) => printExpression(node);

  it("builds props patterns, annotations and type arguments", () => {
    const placeholders = new Placeholders();
    const pattern = js.objectPattern(
      [
        js.bindingProperty("label"),
        js.bindingProperty("tone", placeholders.expression('"info"')),
        js.bindingProperty("items", placeholders.expression("[]")),
      ],
      placeholders.type("BadgeProps"),
    );
    const fn = js.functionDeclaration("Badge", [pattern], [js.returnStatement(js.nullLiteral())], {
      returnType: js.keywordType("null"),
    });
    const call = js.callExpression(
      js.identifier("component$"),
      [
        js.arrowFunction(
          [js.bindingIdentifier("props", placeholders.type("{ a: string }"))],
          js.nullLiteral(),
        ),
      ],
      [placeholders.type("BadgeProps")],
    );
    const code = placeholders.print(() =>
      printProgram(js.program([fn, js.expressionStatement(call)])),
    );
    expect(code).toBe(
      [
        'function Badge({ label, tone = "info", items = [] }: BadgeProps): null {',
        "  return null;",
        "}",
        "component$<BadgeProps>((props: { a: string }) => null);",
        "",
      ].join("\n"),
    );
  });

  it("builds class fields with modifiers", () => {
    const placeholders = new Placeholders();
    const input = js.callExpression(
      js.memberExpression(js.identifier("input"), "required"),
      [],
      [placeholders.type('"info" | "warn"')],
    );
    const fields = js.classDeclaration(
      "Badge",
      [],
      [
        js.propertyDefinition("tone", input, { readonly: true }),
        js.propertyDefinition("Math", js.identifier("Math"), {
          readonly: true,
          accessibility: "protected",
        }),
        js.propertyDefinition("count", null, {
          static: true,
          typeAnnotation: js.keywordType("number"),
        }),
      ],
    );
    expect(placeholders.print(() => printProgram(js.program([fields])))).toBe(
      [
        "class Badge {",
        '  readonly tone = input.required<"info" | "warn">();',
        "  protected readonly Math = Math;",
        "  static count: number;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("builds members, chains, operators, literals and type expressions", () => {
    const a = js.identifier("a");
    expect(print(js.memberExpression(a, "b"))).toBe("a.b");
    expect(print(js.memberExpression(js.identifier("a"), "aria-label"))).toBe('a["aria-label"]');
    expect(print(js.memberExpression(js.identifier("a"), js.identifier("i")))).toBe("a[i]");
    expect(
      print(
        js.chainExpression(
          js.memberExpression(js.identifier("a"), "b", { optional: true }) as never,
        ),
      ),
    ).toBe("a?.b");
    expect(
      print(
        js.conditionalExpression(
          js.logicalExpression("??", js.identifier("a"), js.identifier("b")),
          js.binaryExpression("===", js.identifier("c"), js.numberLiteral(-1)),
          js.unaryExpression("!", js.booleanLiteral(false)),
        ),
      ),
    ).toBe("a ?? b ? c === -1 : !false");
    expect(
      print(
        js.arrayExpression([
          js.stringLiteral("a"),
          js.spreadElement(js.identifier("b")),
          js.objectExpression([
            js.property("on", js.identifier("on"), { shorthand: true }),
            js.property("text-sm", js.nullLiteral()),
            js.spreadElement(js.identifier("c")),
          ]),
        ]),
      ),
    ).toBe('[\n  "a",\n  ...b,\n  {\n    on,\n    "text-sm": null,\n    ...c\n  }\n]');
    expect(
      print(
        js.satisfiesExpression(
          js.asExpression(js.objectExpression([]), js.typeReference("CSSProperties")),
          js.typeReference("Partial", [
            js.unionType([js.keywordType("string"), js.arrayType(js.keywordType("unknown"))]),
          ]),
        ),
      ),
    ).toBe("({} as CSSProperties) satisfies Partial<string | unknown[]>");
    const rest = js.functionDeclaration(
      "cx",
      [js.restElement("parts", js.arrayType(js.keywordType("unknown")))],
      [],
    );
    expect(printProgram(js.program([rest]))).toBe("function cx(...parts: unknown[]) {}\n");
    expect(
      printProgram(
        js.program([
          js.variableDeclaration("let", "props", js.identifier("p"), js.typeReference("P")),
        ]),
      ),
    ).toBe("let props: P = p;\n");
  });

  it("builds JSX elements, fragments, spreads and namespaced names", () => {
    const element = js.jsxElement(
      "Show",
      [
        js.jsxAttribute("when", js.jsxExpressionContainer(js.identifier("on"))),
        js.jsxAttribute("bool:disabled", js.jsxExpressionContainer(js.identifier("off"))),
        js.jsxAttribute("class", "a"),
        js.jsxAttribute("hidden"),
        js.jsxSpreadAttribute(js.identifier("rest")),
      ],
      [js.jsxFragment([js.jsxElement("Foo.Bar")])],
    );
    expect(print(element)).toBe(
      '<Show when={on} bool:disabled={off} class="a" hidden {...rest}><><Foo.Bar /></></Show>',
    );
  });
});

describe("Placeholders", () => {
  it("splices code as written, parenthesised for its slot", () => {
    const placeholders = new Placeholders();
    const member = js.memberExpression(placeholders.expression("a ?? 1000", "operand"), "x");
    const test = js.conditionalExpression(
      placeholders.expression("a ? b : c", "test"),
      placeholders.expression("0.50 /* half */"),
      placeholders.expression("a // trailing comment"),
    );
    const code = placeholders.print(() => printExpression(js.arrayExpression([member, test])));
    expect(code).toBe("[(a ?? 1000).x, (a ? b : c) ? 0.50 /* half */ : a // trailing comment\n]");
    expect(() => new Placeholders().expression("a) + (b")).toThrow("Cannot parse");
  });

  it("names placeholders around text that spells one", () => {
    const placeholders = new Placeholders();
    const value = placeholders.expression("label");
    const spelled = js.stringLiteral("$uf0$0$ and $uf1$");
    expect(placeholders.print(() => printExpression(js.arrayExpression([spelled, value])))).toBe(
      '["$uf0$0$ and $uf1$", label]',
    );
  });

  it("rejects a placeholder printed twice, left out or made while printing", () => {
    const twice = new Placeholders();
    const value = twice.expression("label");
    expect(() => twice.print(() => printExpression(js.arrayExpression([value, value])))).toThrow(
      "printed twice",
    );
    const missing = new Placeholders();
    missing.expression("label");
    expect(() => missing.print(() => "nothing")).toThrow("Placeholders 0 were not printed");
    const late = new Placeholders();
    expect(() => late.print(() => printExpression(late.expression("a")))).toThrow(
      "made while printing",
    );
  });
});

describe("printComponentModule", () => {
  it("prints imports, copied types, the component and its helpers, a blank line apart", async () => {
    const imports = new ImportSet(["Badge"]);
    const show = imports.add("solid-js", "Show");
    imports.add("react", "CSSProperties", { type: true });
    const placeholders = new Placeholders();
    const body = exportDeclaration(
      "Badge",
      js.functionDeclaration(
        "Badge",
        [js.bindingIdentifier("props", placeholders.type("BadgeProps"))],
        [
          js.returnStatement(
            js.jsxElement(
              show,
              [],
              [js.jsxExpressionContainer(placeholders.expression("props.label"))],
            ),
          ),
        ],
      ),
      [{ kind: "default", name: "default", local: "Badge", span: at }],
    );
    const types = [
      createTypeDeclaration(
        "BadgeProps",
        true,
        "interface BadgeProps {\n  label: string; // the label\n}",
        at,
      ),
    ];
    const helpers = [
      'function cx(...parts: unknown[]): string {\n  return parts.join(" ");\n}',
      js.functionDeclaration("noop", [], []),
    ];
    const code = printComponentModule(
      { imports, types, body, helpers, placeholders },
      { jsx: true },
    );
    expect(code).toBe(
      [
        'import type { CSSProperties } from "react";',
        'import { Show } from "solid-js";',
        "",
        "export interface BadgeProps {",
        "  label: string; // the label",
        "}",
        "",
        "export default function Badge(props: BadgeProps) {",
        "  return <Show>{props.label}</Show>;",
        "}",
        "",
        "function cx(...parts: unknown[]): string {",
        '  return parts.join(" ");',
        "}",
        "",
        "function noop() {}",
        "",
      ].join("\n"),
    );
    const outcome = await formatOutput({ path: "Badge.tsx", contents: code });
    expect(outcome.error).toBeUndefined();
    expect(outcome.file.contents).toBe(code);
  });
});
