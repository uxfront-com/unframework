import { describe, expect, it } from "vitest";

import { frameworkOf } from "../src/index.ts";
import { applyAndRecheck, codes, root, run, slices } from "./helpers.ts";

describe("lowering", () => {
  it("lowers elements, text and static attributes with their spans", () => {
    const source =
      'export default function Hello() {\n  return <p class="greeting" hidden>Hi</p>;\n}\n';
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module).toMatchObject({
      irVersion: 1,
      file: "Test.uf.tsx",
      components: [
        {
          name: "Hello",
          render: {
            kind: "Element",
            tag: "p",
            attributes: [
              { kind: "Static", name: "class", value: "greeting" },
              { kind: "Static", name: "hidden", value: true },
            ],
            children: [{ kind: "Text", value: "Hi" }],
          },
        },
      ],
      exports: [{ kind: "default", name: "default", local: "Hello" }],
    });
    const render = module!.components[0]!.render;
    expect(source.slice(render.span.start, render.span.end)).toBe(
      '<p class="greeting" hidden>Hi</p>',
    );
    const text = render.children[0]!;
    expect(source.slice(text.span.start, text.span.end)).toBe("Hi");
  });

  it("applies JSX whitespace rules and decodes references in text and attributes", () => {
    const { module } = run(
      [
        "export function Card() {",
        "  return (",
        '    <div title="Tom &amp; Jerry">',
        "      Line one &amp;",
        "      line two<br />",
        "      <span> spaced </span>",
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );
    const div = root(module);
    expect(div.attributes[0]).toMatchObject({ value: "Tom & Jerry" });
    expect(
      div.children.map((child) =>
        child.kind === "Text"
          ? child.value
          : child.kind === "Element"
            ? `<${child.tag}>`
            : child.kind,
      ),
    ).toEqual(["Line one & line two", "<br>", "<span>"]);
    const span = div.children[2]!;
    expect(span.kind === "Element" && span.children).toEqual([
      expect.objectContaining({ kind: "Text", value: " spaced " }),
    ]);
  });

  it("drops JSX comments and merges the text around them", () => {
    const { module } = run("export function A() { return <p>a{/* note */}b</p>; }");
    expect(module!.components[0]!.render.children).toEqual([
      expect.objectContaining({ kind: "Text", value: "ab" }),
    ]);
  });

  it("keeps the export shape of each component", () => {
    const { module, diagnostics } = run(
      [
        "export default function A() { return <p />; }",
        "export function B() { return <p />; }",
        "function C() { return <p />; }",
        "export { C as Renamed };",
      ].join("\n"),
    );
    expect(diagnostics).toEqual([]);
    expect(module!.exports.map((entry) => `${entry.kind}:${entry.name}=${entry.local}`)).toEqual([
      "default:default=A",
      "named:B=B",
      "named:Renamed=C",
    ]);
  });
});

describe("diagnostics", () => {
  it("reports syntax errors as UF1001 and stops", () => {
    const { module, diagnostics } = run("export function A() { return <p>a</q>; }");
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF1001"]);
    expect(diagnostics[0]!.related).toEqual([expect.objectContaining({ message: "Opened here" })]);
  });

  it("rejects framework imports with UF1201 on the module specifier", () => {
    const source =
      'import { useState } from "react";\nexport default function A() { return <p />; }';
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF1201"]);
    expect(slices(source, diagnostics)).toEqual(['"react"']);
    expect(diagnostics[0]!.message).toBe(
      '"react" is a React module, and components are framework-free.',
    );
  });

  it.each([
    ["react", "React"],
    ["react-dom/client", "React"],
    ["preact/hooks", "Preact"],
    ["vue", "Vue"],
    ["@vue/reactivity", "Vue"],
    ["svelte/store", "Svelte"],
    ["solid-js/web", "Solid"],
    ["@solidjs/router", "Solid"],
    ["@angular/core", "Angular"],
    ["@qwik.dev/core", "Qwik"],
    ["@builder.io/qwik", "Qwik"],
    ["astro:content", "Astro"],
    ["lit", "Lit"],
  ])("knows %s belongs to %s", (specifier, framework) => {
    expect(frameworkOf(specifier)).toBe(framework);
  });

  it.each(["unframework", "./tokens.ts", "reactive-thing", "vue-ish", "solid"])(
    "does not mistake %s for a framework",
    (specifier) => {
      expect(frameworkOf(specifier)).toBeUndefined();
    },
  );

  it("erases the authoring API, and its types", () => {
    const { diagnostics } = run(
      'import { ref } from "unframework";\nimport type { Ref } from "unframework";\nexport function A() { return <p />; }',
    );
    expect(diagnostics).toEqual([]);
  });

  // Props types from other modules land with M5's type oracle (ADR-0034).
  it("reports type-only imports from other modules as not supported yet", () => {
    const source = 'import type { X } from "./types.ts";\nexport function A() { return <p />; }';
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.message).toBe(
      "Importing types from other modules is not supported yet: props types from other modules land in M5.",
    );
  });

  it("reports value imports and stylesheets as not supported yet", () => {
    const source =
      'import "./A.css";\nimport { x } from "./x.ts";\nexport function A() { return <p />; }';
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(codes(diagnostics)).toEqual(["UF1002", "UF1002"]);
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Stylesheets are not supported yet.",
      "Importing modules is not supported yet.",
    ]);
  });

  it("reports a file without an exported component as UF1101", () => {
    expect(codes(run("export {};").diagnostics)).toEqual(["UF1101"]);
  });

  it("reports local components, setup code and async functions as not supported yet", () => {
    const source = [
      "function Local() { return <p />; }",
      "export function Setup() { const a = 1; return <p />; }",
      "export async function Async() { return <p />; }",
      "export function Ok() { return <p />; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1002", "UF1002", "UF1002"]);
    expect(slices(source, diagnostics)).toEqual(["Local", "const a = 1;", "Async"]);
    expect(diagnostics[1]!.message).toBe(
      "Setup code in a component's body is not supported yet: it lands in M2.",
    );
    // An error in one component never stops its siblings.
    expect(module!.components.map((component) => component.name)).toEqual(["Ok"]);
    expect(module!.exports.map((entry) => entry.local)).toEqual(["Ok"]);
  });

  it("reports a component that does not end by returning JSX as UF1102", () => {
    const source = 'export function A() { return "text"; }\nexport function* B() { return <p />; }';
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1102", "UF1102"]);
  });

  it("reports an anonymous default export as UF1102", () => {
    expect(codes(run("export default function () { return <p />; }").diagnostics)).toContain(
      "UF1102",
    );
    expect(codes(run("export default () => <p />;").diagnostics)).toEqual(["UF1102"]);
  });

  // React's spelling: a `const` holding an arrow function. A component is a declaration, which
  // the fix writes; the value is checked as that declaration, so the fix reveals nothing new.
  it.each([
    [
      "interface CardProps { title: string }\nexport const Card = ({ title }: CardProps) => <h2>{title}</h2>;",
      "export function Card({ title }: CardProps) { return <h2>{title}</h2>; }",
    ],
    [
      "interface CardProps { title: string }\nconst Card = ({ title }: CardProps) => {\n  return <h2>{title}</h2>;\n};\nexport default Card;",
      "function Card({ title }: CardProps) {\n  return <h2>{title}</h2>;\n}\nexport default Card;",
    ],
    [
      "export const Card = () => (\n  <h2>Hi</h2>\n);",
      "export function Card() { return <h2>Hi</h2>; }",
    ],
    [
      "const Card = function (props: { title: string }) { return <h2>{props.title}</h2>; };\nexport { Card };",
      "function Card(props: { title: string }) { return <h2>{props.title}</h2>; }\nexport { Card };",
    ],
    [
      "export const Card = props => <h2>x</h2>;",
      "export function Card(props) { return <h2>x</h2>; }",
    ],
  ])("reports a component written as a value, and declares it: %s", (source, fixed) => {
    const { module, diagnostics } = run(source);
    expect(module?.components).toEqual([]);
    const reported = diagnostics.find((diagnostic) => diagnostic.code === "UF1102")!;
    expect(reported.message).toMatch(
      /^Card is an? (arrow function|function expression) in a `const`/,
    );
    expect(codes(diagnostics).filter((code) => code === "UF1002")).toEqual([]);
    expect(applyAndRecheck(source, diagnostics).endsWith(fixed)).toBe(true);
  });

  it("checks a component written as a value as the declaration its fix writes", () => {
    const source =
      'interface CardProps { title: string }\nexport const Card = ({ title }: CardProps) => <h2 className="t" onClick={go}>{title}</h2>;';
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1102", "UF1002", "UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      'export function Card({ title }: CardProps) { return <h2 class="t"',
    );
  });

  it("offers no rewrite of a typed or async value, nor names a lower-case one a component", () => {
    for (const source of [
      "export const Card: Fc = () => <h2>x</h2>;",
      "export const Card = async () => <h2>x</h2>;",
    ]) {
      const reported = run(source).diagnostics.find((diagnostic) => diagnostic.code === "UF1102")!;
      expect(reported.fixes, source).toBeUndefined();
    }
    const lower = run("export const card = () => <h2>x</h2>;").diagnostics;
    expect(codes(lower)).toEqual(["UF1102"]);
    expect(lower[0]!.message).toContain("PascalCase");
  });

  it("reports each JSX construct M1 does not lower, and keeps going", () => {
    const source = [
      "export function A() {",
      "  return (",
      '    <div ref="r" v-model="x" v-model:open="x" onClick={go}>',
      "      <Child />",
      "      <svg:rect />",
      "      <a.b />",
      "      {...children}",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(module!.components).toEqual([]);
    expect(slices(source, diagnostics)).toEqual([
      "ref",
      "v-model",
      "v-model:open",
      "onClick",
      "Child",
      "svg:rect",
      "a.b",
      "{...children}",
    ]);
    expect(new Set(codes(diagnostics))).toEqual(new Set(["UF1002"]));
  });

  it("lowers a returned fragment, and reports an empty one as rendering nothing", () => {
    const { module, diagnostics } = run("export function A() { return <><p>a</p><p>b</p></>; }");
    expect(diagnostics).toEqual([]);
    expect(module!.components[0]!.render).toMatchObject({
      kind: "Fragment",
      children: [{ tag: "p" }, { tag: "p" }],
    });
    for (const fragment of ["<></>", "<>{null}{/* c */}</>"]) {
      const empty = run(`export function A() { return ${fragment}; }`);
      expect(codes(empty.diagnostics)).toEqual(["UF1102"]);
      expect(empty.diagnostics[0]!.message).toBe("A renders nothing: its fragment is empty.");
    }
  });

  it("reports other top-level declarations as not supported yet", () => {
    const { diagnostics } = run("const x = 1;\nexport function A() { return <p />; }");
    expect(codes(diagnostics)).toEqual(["UF1002"]);
  });

  it("reports duplicate declarations and exports as syntax errors, as the module loader would", () => {
    const twoDefaults = run(
      "export default function A() { return <p />; }\nexport default function B() { return <p />; }",
    );
    expect(twoDefaults.module).toBeUndefined();
    expect(
      twoDefaults.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message]),
    ).toEqual([["UF1001", "Duplicated export `default`"]]);
    const twice = run(
      "export function A() { return <p />; }\nexport function A() { return <p />; }",
    );
    expect(twice.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.message])).toEqual([
      ["UF1001", "Identifier `A` has already been declared"],
    ]);
  });

  // Each target writes `export { A as name }`, and consumers import the name as a tag.
  it("reports an export name that is not an identifier as UF1103", () => {
    const source = 'function A() { return <p />; }\nexport { A as "my card", A as default };';
    const { module, diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1103"]);
    expect(slices(source, diagnostics)).toEqual(['A as "my card"']);
    expect(module!.components).toEqual([]);
  });

  it("accepts string export names that are identifiers", () => {
    const { module, diagnostics } = run('function A() { return <p />; }\nexport { A as "B" };');
    expect(diagnostics).toEqual([]);
    expect(module!.exports.map((entry) => entry.name)).toEqual(["B"]);
  });

  // Angular names files and selectors in kebab case, and macOS's file system ignores case.
  it("reports components whose names differ only in case as UF1104", () => {
    const source = [
      "export function Card() { return <p />; }",
      "export function CARD() { return <p />; }",
      "export function ABTest() { return <p />; }",
      "export function AbTest() { return <p />; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1104", "UF1104"]);
    expect(slices(source, diagnostics)).toEqual(["CARD", "AbTest"]);
    expect(diagnostics[0]!.message).toBe(
      "CARD and Card differ only in case, so their output files collide.",
    );
    expect(diagnostics[0]!.related).toEqual([
      { span: { start: 16, end: 20 }, message: "Card is declared here" },
    ]);
    expect(module!.components.map((component) => component.name)).toEqual(["Card", "ABTest"]);
  });
});

describe("the module's statements", () => {
  // A stray `;` does nothing: after a function, or doubled after the return.
  it.each([
    "export function A() { return <p>x</p>; };",
    "export function A() { return <p>x</p>;; }",
    ";export default function A() { ; return <p>x</p>; ; }",
    '"use strict";\nexport function A() { "use strict"; return <p>x</p>; }',
  ])("accepts %s", (source) => {
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.components.map((component) => component.name)).toEqual(["A"]);
  });

  it.each([
    ['"use client";\nexport function A() { return <p>x</p>; }', '"use client";'],
    ["export function A() { 'use memo'; return <p>x</p>; }", "'use memo';"],
  ])("reports the directive in %s as a directive", (source, at) => {
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(slices(source, diagnostics)).toEqual([at]);
    expect(diagnostics[0]!.message).toBe(
      `Directives such as ${at.slice(0, -1)} are not supported yet: each target's output carries the directives its framework needs.`,
    );
  });

  // JSX reads a lower-case tag as an element, so such a function could never be a component.
  it.each([
    ["export default function myCard() { return <p>a</p>; }", "myCard", "MyCard"],
    ["export function card() { return <p>a</p>; }", "card", "Card"],
    ["export function my_card() { return (<p>a</p>); }", "my_card", "MyCard"],
  ])("reports %s as a misnamed component, with a rename", (source, name, pascal) => {
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1102"]);
    expect(slices(source, diagnostics)).toEqual([name]);
    expect(diagnostics[0]).toMatchObject({
      message: `${name} returns JSX, as a component does, but a component's name is PascalCase.`,
      help: `Name it in PascalCase, such as \`${pascal}\`: JSX reads a lower-case tag as an HTML element.`,
      fixes: [{ title: `Rename \`${name}\` to \`${pascal}\``, confidence: "likely" }],
    });
    expect(applyAndRecheck(source, diagnostics)).toContain(`function ${pascal}()`);
  });

  // JSX reads these as components, but a component's name keeps to ASCII letters and digits.
  it.each([
    ["export function My_Card() { return (<p>a</p>); }", "My_Card", "MyCard"],
    ["export function $card() { return <p>a</p>;; }", "$card", "Card"],
    ["export function _Card() { return <p>a</p>; }", "_Card", "Card"],
  ])(
    "reports %s as a component name outside the pattern, with a rename",
    (source, name, pascal) => {
      const { diagnostics } = run(source);
      expect(codes(diagnostics)).toEqual(["UF1102"]);
      expect(diagnostics[0]).toMatchObject({
        message: `${name} returns JSX, as a component does, but a component's name is PascalCase in ASCII letters and digits.`,
        help: `Name it with ASCII letters and digits, starting with an upper-case letter, such as \`${pascal}\`: every target names files after the component.`,
        fixes: [{ title: `Rename \`${name}\` to \`${pascal}\``, confidence: "likely" }],
      });
      expect(applyAndRecheck(source, diagnostics)).toContain(`function ${pascal}()`);
    },
  );

  it.each([
    "function card() { return <p>a</p>; }\nexport { card };",
    "function card() { return <p>a</p>; }\nexport default card;",
    "export function card() { return <p>a</p>; }\nexport function Card() { return <p>b</p>; }",
    "export function écran() { return <p>a</p>; }",
    "export function Café() { return <p>a</p>; }",
  ])(
    "reports %s as a misnamed component, with no rename that would miss a use or collide",
    (source) => {
      const misnamed = run(source).diagnostics.find((diagnostic) => diagnostic.code === "UF1102")!;
      expect(misnamed.message).toMatch(
        /^\S+ returns JSX, as a component does, but a component's name is PascalCase/,
      );
      expect(misnamed.fixes).toBeUndefined();
    },
  );

  // Plan §4.6: a local function that returns JSX is a helper, not a component, and renaming it
  // would make a local component (UF1002), so there is no fix.
  it.each([
    [
      'function renderIcon() {\n  return <i class="icon"></i>;\n}\n\nexport function Button() {\n  return <button type="button">Go</button>;\n}\n',
      "renderIcon",
    ],
    ["function rows() { return <></>; }\nexport function A() { return <p />; }", "rows"],
    [
      "function Card_Item() { return <p>a</p>; }\nexport function A() { return <p />; }",
      "Card_Item",
    ],
  ])("reports the helper in %j as JSX outside a template", (source, name) => {
    const { module, diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF3012"]);
    expect(slices(source, diagnostics)).toEqual([name]);
    expect(diagnostics[0]).toEqual(
      expect.objectContaining({
        message: `${name} is a helper that returns JSX, and JSX can only be in a component's template: the tree the component returns, and its slot functions.`,
        help: "Inline the JSX where it is used, or extract a component: an exported function with a PascalCase name.",
      }),
    );
    expect(diagnostics[0]!.fixes).toBeUndefined();
    expect(module).toBeUndefined();
  });

  it("reports a helper exported only as a type as a helper", () => {
    const source =
      "function card() { return <p>a</p>; }\nexport type { card };\nexport function A() { return <p />; }";
    expect(codes(run(source).diagnostics)).toEqual(["UF3012", "UF1002"]);
  });

  it("keeps the generic report for a function that does not return JSX", () => {
    const { diagnostics } = run(
      "export function helper() { return 1; }\nexport function A() { return <p />; }",
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      "Top-level declarations other than imports and components are not supported yet.",
    ]);
  });

  // A type-only export exports no value (TS1361): it is the component's type, for consumers.
  it.each([
    ["function A() { return <p>a</p>; }\nexport type { A };", "export type { A };"],
    ["function A() { return <p>a</p>; }\nexport { type A as default };", "type A as default"],
    [
      "export function B() { return <p>b</p>; }\nfunction A() { return <p>a</p>; }\nexport { type A, B as C };",
      "type A",
    ],
  ])("reports the type-only export in %s", (source, at) => {
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    // The component is still checked: it is local, since a type-only export exports no value.
    expect(codes(diagnostics)).toEqual(["UF1002", "UF1002"]);
    expect(slices(source, diagnostics)).toEqual([at, "A"]);
    expect(diagnostics[0]!.message).toBe("Type-only exports are not supported yet.");
  });
});

describe("syntax errors", () => {
  // oxc advises `{'}'}`, an expression, or `&rbrace;`, which JSX renders as written. It stops
  // at the first raw one, so the fix also writes those it would meet next.
  it.each([
    ["<p>a } b</p>", "}", "&#x7D;", "<p>a &#x7D; b</p>"],
    ["<p>a > b</p>", ">", "&gt;", "<p>a &gt; b</p>"],
    ["<p>a }} b > c<b>}</b></p>", "}", "&#x7D;", "<p>a &#x7D;&#x7D; b &gt; c<b>&#x7D;</b></p>"],
    [
      "<div><p>a } b</p><p>c } d</p></div>",
      "}",
      "&#x7D;",
      "<div><p>a &#x7D; b</p><p>c &#x7D; d</p></div>",
    ],
  ])("advises the reference for a raw %s, with its fix", (jsx, token, reference, fixed) => {
    const source = `export function A() { return ${jsx}; }`;
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1001"]);
    expect(slices(source, diagnostics)).toEqual([token]);
    expect(diagnostics[0]).toMatchObject({
      message: `Unexpected token: JSX text cannot hold a raw \`${token}\`.`,
      fixes: [{ confidence: "likely" }],
    });
    expect(diagnostics[0]!.help).toMatch(new RegExp(`^Write \`${reference}\` for the character`));
    expect(diagnostics[0]!.help).not.toMatch(/Did you mean/);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  // An element left open makes text of the code after it, and the parser reports its `}`:
  // the rewrite would only move the error.
  it.each([
    "export function Greeting() {\n  return <p>Hello;\n}\n",
    "export function Greeting() {\n  return <div><p>Hello</div>;\n}\n",
    "export function A() { return <p>a } b; }\nexport function B() { return <p>x</p>; }",
    "export function A() {\n  return <p>Hello;\n  if (a > b) x();\n}\n",
    "export function A() { return <div><p>a > b</div>; }",
  ])("offers no rewrite after which %j still fails to parse", (source) => {
    const error = run(source).diagnostics.at(-1)!;
    expect(error.message).toMatch(/^Unexpected token: JSX text cannot hold a raw `[}>]`\.$/);
    expect(error.help).toMatch(
      /^If the `[}>]` is text, write `(&#x7D;|&gt;)`: .+ If it is code, close the element before it\.$/,
    );
    expect(error.fixes).toBeUndefined();
  });

  it("offers no rewrite that reveals an error the parser stopped before", () => {
    const { diagnostics } = run("export function A() { return <p>a > b</p>; }\nconst x = ;");
    expect(codes(diagnostics)).toEqual(["UF1001"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it("keeps the parser's message for other errors", () => {
    expect(run("export function A() { return <p>a</q>; }").diagnostics[0]!.message).toBe(
      "Expected corresponding JSX closing tag for 'p'.",
    );
  });
});
