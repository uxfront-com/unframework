import { describe, expect, it } from "vitest";

import {
  findComponents,
  findTypeDeclarations,
  isComponentName,
  parseDeclarations,
  parseModule,
  parseStylesheet,
  visitorKeys,
} from "../src/index.ts";

describe("parseModule", () => {
  it("parses TSX with UTF-16 spans", () => {
    const source = "export default function Hello() {\n  return <p>é😀 x</p>;\n}\n";
    const parsed = parseModule("Hello.uf.tsx", source);
    expect(parsed.errors).toEqual([]);
    const text = "é😀 x";
    const statement = parsed.program.body[0]!;
    expect(statement.type).toBe("ExportDefaultDeclaration");
    expect(source.slice(source.indexOf(text), source.indexOf(text) + text.length)).toBe(text);
    expect(parsed.program.end).toBe(source.length);
  });

  it("does not keep parentheses as nodes", () => {
    const parsed = parseModule("A.uf.tsx", "export function A() { return (<p />); }");
    const fn = parsed.program.body[0]!;
    if (fn.type !== "ExportNamedDeclaration" || fn.declaration?.type !== "FunctionDeclaration") {
      throw new Error("unexpected AST");
    }
    const ret = fn.declaration.body!.body[0]!;
    expect(ret.type === "ReturnStatement" && ret.argument?.type).toBe("JSXElement");
  });

  it("returns syntax errors with their labelled spans instead of throwing", () => {
    const source = "export function X() { return <p>a</q>; }";
    const { errors } = parseModule("X.uf.tsx", source);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("closing tag");
    expect(source.slice(errors[0]!.span.start, errors[0]!.span.end)).toBe("q");
    expect(errors[0]!.labels.map((label) => label.message)).toEqual([
      "Expected `</p>`",
      "Opened here",
    ]);
  });

  it("parses .uf.ts modules as TypeScript, where JSX is a syntax error", () => {
    expect(parseModule("use.uf.ts", "export const x = <p />;").errors.length).toBeGreaterThan(0);
    expect(parseModule("use.uf.ts", "export const x = <number>1;").errors).toEqual([]);
  });

  // The analyser's scope analysis (scope-manager) reads `range` to resolve references.
  it("gives every node a range beside its start and end", () => {
    const { program } = parseModule(
      "A.uf.tsx",
      "export function A({ a }: P) { return <p>{a}</p>; }",
    );
    const statement = program.body[0]!;
    expect(statement.range).toEqual([statement.start, statement.end]);
  });

  it("re-exports oxc's visitor keys", () => {
    expect(visitorKeys.JSXElement).toEqual(["openingElement", "children", "closingElement"]);
  });

  it("records static imports", () => {
    const { module } = parseModule("A.uf.tsx", 'import { useState } from "react";');
    expect(module.staticImports.map((entry) => entry.moduleRequest.value)).toEqual(["react"]);
  });
});

describe("findComponents", () => {
  const source = [
    "export default function Hello() { return <p />; }",
    "export function Card() { return <p />; }",
    "function Local() { return <p />; }",
    "function Later() { return <p />; }",
    "export { Later, Later as Renamed };",
    "export function notAComponent() {}",
    "function Defaulted() { return <p />; }",
  ].join("\n");
  const components = findComponents(parseModule("Many.uf.tsx", source).program);

  it("finds PascalCase function declarations in source order", () => {
    expect(components.map((component) => component.name)).toEqual([
      "Hello",
      "Card",
      "Local",
      "Later",
      "Defaulted",
    ]);
  });

  it("records each export form", () => {
    const exportsOf = (name: string) =>
      components
        .find((component) => component.name === name)!
        .exports.map((e) => `${e.kind}:${e.name}`);
    expect(exportsOf("Hello")).toEqual(["default:default"]);
    expect(exportsOf("Card")).toEqual(["named:Card"]);
    expect(exportsOf("Local")).toEqual([]);
    expect(exportsOf("Later")).toEqual(["named:Later", "named:Renamed"]);
  });

  it("follows `export default Name`", () => {
    const [component] = findComponents(
      parseModule("D.uf.tsx", "function D() { return <p />; }\nexport default D;").program,
    );
    expect(component!.exports.map((e) => e.kind)).toEqual(["default"]);
  });

  // A type-only export exports no value: consumers cannot render it (TS1361).
  it.each([
    "export type { A };",
    "export { type A };",
    "export { type A as default };",
    "export type { A as B };",
  ])("records no export for `%s`", (statement) => {
    const [component] = findComponents(
      parseModule("A.uf.tsx", `function A() { return <p />; }\n${statement}`).program,
    );
    expect(component!.exports).toEqual([]);
  });

  it("records the value specifiers of a statement that mixes in a type-only one", () => {
    const mixed =
      "function A() { return <p />; }\nfunction B() { return <p />; }\nexport { type A, B };";
    const found = findComponents(parseModule("A.uf.tsx", mixed).program);
    expect(found.map((component) => [component.name, component.exports.length])).toEqual([
      ["A", 0],
      ["B", 1],
    ]);
  });

  it("recognises PascalCase names", () => {
    expect(isComponentName("Hello")).toBe(true);
    expect(isComponentName("HTMLView2")).toBe(true);
    expect(isComponentName("hello")).toBe(false);
    expect(isComponentName("Hello_World")).toBe(false);
  });
});

describe("findTypeDeclarations", () => {
  it("finds interfaces and aliases, plain and exported, in source order", () => {
    const source = [
      "interface A { a: string }",
      "export interface B { b: number }",
      'type C = "x" | "y";',
      "export type D = { d: C };",
      "const e = 1;",
      "export function F() { return <p />; }",
      'export type { A } from "./a.ts";',
    ].join("\n");
    const found = findTypeDeclarations(parseModule("A.uf.tsx", source).program);
    expect(found.map((item) => [item.name, item.exported, item.node.type])).toEqual([
      ["A", false, "TSInterfaceDeclaration"],
      ["B", true, "TSInterfaceDeclaration"],
      ["C", false, "TSTypeAliasDeclaration"],
      ["D", true, "TSTypeAliasDeclaration"],
    ]);
    // The statement includes `export`; the declaration starts at its keyword.
    const exported = found[1]!;
    expect(source.slice(exported.span.start, exported.span.end)).toBe(
      "export interface B { b: number }",
    );
    expect(source.slice(exported.node.start, exported.node.end)).toBe("interface B { b: number }");
  });
});

describe("parseDeclarations", () => {
  /** Each declaration as `property: value`, with the text its spans cover. */
  function declarationsOf(source: string) {
    const { declarations, errors } = parseDeclarations(source);
    expect(errors).toEqual([]);
    for (const declaration of declarations) {
      expect(source.slice(declaration.propertySpan.start, declaration.propertySpan.end)).toBe(
        declaration.property,
      );
      expect(source.slice(declaration.valueSpan.start, declaration.valueSpan.end)).toBe(
        declaration.value,
      );
    }
    return declarations.map((declaration) => `${declaration.property}: ${declaration.value}`);
  }

  it("keeps each property and value as written, trimmed", () => {
    expect(declarationsOf("color: red; margin-top:4px ;  --Gap :  1px  ")).toEqual([
      "color: red",
      "margin-top: 4px",
      "--Gap: 1px",
    ]);
  });

  // A `;` or `:` in a string, a comment or brackets does not split the list.
  it.each([
    ['background: url("a;b:c")', ['background: url("a;b:c")']],
    ["font-family: 'a;b'; color: red", ["font-family: 'a;b'", "color: red"]],
    ["/* a; b: c */ color: red /* d; */", ["color: red"]],
    ["width: calc(1px + var(--a, 2px))", ["width: calc(1px + var(--a, 2px))"]],
  ])("splits %j where CSS does", (source, expected) => {
    expect(declarationsOf(source)).toEqual(expected);
  });

  it("skips empty declarations and keeps an empty value", () => {
    expect(declarationsOf(";; color: red;;; --x: ;")).toEqual(["color: red", "--x: "]);
    expect(parseDeclarations("  ").declarations).toEqual([]);
  });

  it("keeps !important in the value, for the analyser to report", () => {
    expect(declarationsOf("color: red !important")).toEqual(["color: red !important"]);
  });

  it.each([
    ["color red", "Expected a colon after the property"],
    [": red", "Expected a property before the colon"],
    ["color: {}", "Unexpected token CurlyBracketBlock"],
  ])("reports the syntax error in %j", (source, message) => {
    expect(parseDeclarations(source).errors.map((error) => error.message)).toEqual([message]);
  });
});

describe("parseStylesheet", () => {
  it("parses a valid stylesheet without errors", () => {
    expect(
      parseStylesheet("Card.css", ".card { color: red }\n.card > h2, p:hover { margin: 0 }"),
    ).toEqual({
      file: "Card.css",
      source: ".card { color: red }\n.card > h2, p:hover { margin: 0 }",
      errors: [],
    });
  });

  // lightningcss's columns are 1-based UTF-16 units, and CRLF, CR and form feed end lines.
  it.each([
    ["%{}", "%"],
    [".a > { }", "{"],
    ["x{}\n%{}", "%"],
    ["x{}\r\n\r\n %{}", "%"],
    ["x{}\r%{}", "%"],
    ["x{}\f%{}", "%"],
    ["/* é😀 */\n  %{}", "%"],
  ])("points the error in %j at the offending token", (source, token) => {
    const { errors } = parseStylesheet("Bad.css", source);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.span.start).toBe(source.indexOf(token));
  });

  it("clamps a location past the end of the source to its end", () => {
    const source = ".x {{ }";
    const { errors } = parseStylesheet("Bad.css", source);
    expect(errors[0]!.span.start).toBeLessThanOrEqual(source.length);
  });
});

/** A module's errors, with the source text of each label. */
function errorsOf(source: string) {
  return parseModule("A.uf.tsx", source).errors.map((error) => ({
    message: error.message,
    labels: error.labels.map((label) => source.slice(label.span.start, label.span.end)),
  }));
}

describe("module early errors", () => {
  it.each([
    ["two function declarations", "function A() {}\nfunction A() {}", ["A", "A"]],
    ["a function and a class", "function A() {}\nclass A {}", ["A", "A"]],
    ["a function, then a var", "function A() {}\nvar A;", ["A", "A"]],
    ["an import and a function", 'import { A } from "./a.ts";\nfunction A() {}', ["A", "A"]],
    ["an import and a const", 'import A from "./a.ts";\nconst A = 1;', ["A", "A"]],
    ["a destructured const and a function", "const { x: [A] } = y;\nfunction A() {}", ["A", "A"]],
    [
      "two exported components",
      "export function A() { return <p />; }\nexport function A() { return <p />; }",
      ["A", "A"],
    ],
  ])("reports %s declaring the same name", (_, source, labels) => {
    expect(errorsOf(source)).toEqual([
      { message: "Identifier `A` has already been declared", labels },
    ]);
  });

  it.each([
    [
      "two default exports",
      "export default function A() {}\nexport default function B() {}",
      "default",
      ["export default", "export default"],
    ],
    ["an export list naming twice", "function A() {}\nexport { A, A };", "A", ["A", "A"]],
    [
      "two locals under one name",
      "function A() {}\nfunction B() {}\nexport { A as X, B as X };",
      "X",
      ["X", "X"],
    ],
    [
      "a declaration and a list",
      "export function A() {}\nfunction B() {}\nexport { B as A };",
      "A",
      ["A", "A"],
    ],
    [
      "a string name and a default",
      'function A() {}\nexport default A;\nexport { A as "default" };',
      "default",
      ["export default", '"default"'],
    ],
  ])("reports %s as a duplicated export", (_, source, name, labels) => {
    expect(errorsOf(source)).toEqual([{ message: `Duplicated export \`${name}\``, labels }]);
  });

  it("reports an export of a name the module does not declare", () => {
    expect(errorsOf("export { Nope };")).toEqual([
      { message: "Export `Nope` is not defined", labels: ["Nope"] },
    ]);
  });

  it("reports a conflict oxc already reports only once", () => {
    expect(errorsOf("let A;\nfunction A() {}")).toHaveLength(1);
  });

  it.each([
    ["overload signatures", "export function A(): void;\nexport function A(a?: string) {}"],
    ["an ambient declaration", "declare function A(): void;\nfunction A() {}"],
    ["two vars", "var a;\nvar a;"],
    ["a type and a value", "export interface A {}\nexport function A() {}"],
    [
      "a type-only import and a value",
      'import type { A } from "./a.ts";\nexport function B() {}\nexport type { A };',
    ],
    ["a namespace merged with a function", "function A() {}\nnamespace A {}"],
    [
      "exports of types and imports",
      'import { B } from "./b.ts";\ninterface A {}\nexport { A, B };',
    ],
    ["a string export name", 'function A() {}\nexport { A as "my card" };'],
  ])("accepts %s", (_, source) => {
    expect(errorsOf(source)).toEqual([]);
  });
});
