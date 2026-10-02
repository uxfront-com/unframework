import { runInNewContext } from "node:vm";

import { createElement, createStaticAttribute, createText } from "@unframework/ir";
import { transformWithOxc } from "vite";
import { describe, expect, it } from "vitest";

import {
  exportDeclaration,
  formatOutput,
  ImportSet,
  isBlockElement,
  isVoidElement,
  js,
  jsxElement,
  jsxText,
  kebabCase,
  pascalCase,
  printExpression,
  printModule,
  printProgram,
} from "../src/index.ts";

const at = { start: 0, end: 0 };

/** Text with every character outside printable ASCII as a `\uXXXX` escape, for messages. */
const escape = (text: string) =>
  text.replace(/[^\x21-\x7e]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);

/** A classic JSX pragma that makes each element its text. */
const textOf = (_tag: string, _props: unknown, ...children: string[]) => children.join("");

describe("jsx", () => {
  it("writes text as JSX text with references, or as a string where JSX would change it", () => {
    const print = (value: string) =>
      printExpression(jsxElement(createElement("p", [], [createText(value, at)], at)) as never);
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
    const code = printExpression(
      jsxElement(node, {
        attributeName: (name) => (name === "for" ? "htmlFor" : name),
        presentAttributeValue: (name) => (name === "hidden" ? true : ""),
      }) as never,
    );
    expect(code).toBe('<label htmlFor="x" data-on="" hidden title={"say \\"hi\\""} />');
  });

  it("quotes attribute values only when quoting keeps them exactly", () => {
    const print = (value: string) =>
      printExpression(
        jsxElement(
          createElement("p", [createStaticAttribute("title", value, at)], [], at),
        ) as never,
      );
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
