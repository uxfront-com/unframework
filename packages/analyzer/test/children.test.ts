import type { RenderNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, only, problems, root, run } from "./helpers.ts";

const PROPS = "label: string; count: number; on: boolean; items: string[]; maybe?: string";

/** A render tree as a compact string: elements, texts, interpolations, ifs and lists. */
function shape(nodes: readonly RenderNode[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "Element":
          return `<${node.tag}>${shape(node.children)}</${node.tag}>`;
        case "Text":
          return JSON.stringify(node.value);
        case "Interpolation":
          return `{${node.value.code}}`;
        case "If":
          return `if(${node.branches
            .map((branch) => `${branch.condition?.code ?? "else"}: ${shape(branch.children)}`)
            .join(" | ")})`;
        case "For":
          return `for(${node.source.code}: ${shape([node.body])})`;
      }
    })
    .join(" ");
}

/** The shape of the children of the `<p>` a component returns. */
function lowered(children: string, props = PROPS): string {
  const { module, diagnostics } = component(`<p>${children}</p>`, { props });
  expect(diagnostics).toEqual([]);
  return shape(root(module).children);
}

describe("expression children", () => {
  it.each([
    ["{/* note */}", ""],
    ["{null}", ""],
    ["{undefined}", ""],
    ['{""}', ""],
    ["{``}", ""],
    ['{"a"}', '"a"'],
    ["{`a`}", '"a"'],
    ['{"  two  spaces "}', '"  two  spaces "'],
    ['{"\\n"}', '"\\n"'],
    ["{label}", "{label}"],
    ['{on ? "yes" : "no"}', '{on ? "yes" : "no"}'],
    ['{maybe ?? "none"}', '{maybe ?? "none"}'],
  ])("lowers %s", (child, expected) => {
    expect(lowered(child)).toBe(expected);
  });

  it.each(["{true}", "{false}"])(
    "reports %s, which renders nothing in JSX only (UF3016)",
    (child) => {
      const { source, diagnostics } = component(`<p>a${child}</p>`);
      expect(problems(source, diagnostics)).toEqual([`UF3016 ${child.slice(1, -1)}`]);
    },
  );

  it.each([
    ["on", "a boolean"],
    ["items", "an array"],
    ["{ a: 1 }", "an object"],
  ])("reports {%s}, which renders differently as text (UF3016)", (expression, kind) => {
    const { diagnostics } = component(`<p>{${expression}}</p>`, { props: PROPS });
    expect(codes(diagnostics)).toEqual(["UF3016"]);
    expect(diagnostics[0]!.message).toContain(`can be ${kind}`);
  });

  it("reads a string literal as JavaScript does: no entity decoding, real escapes", () => {
    expect(lowered('{"a &amp; \\t b"}')).toBe(JSON.stringify("a &amp; \t b"));
  });

  it.each([
    ['{"a\\rb"}', "\\r"],
    ['{"a\\0b"}', "\\0"],
    ['{"a\\u0007b"}', "\\u0007"],
    ["{`a\\uDC00b`}", "\\uDC00"],
  ])("reports the character in %s HTML would not keep (UF3010), at its escape", (child, at) => {
    const { source, diagnostics } = component(`<p>${child}</p>`);
    expect(problems(source, diagnostics)).toEqual([`UF3010 ${at}`]);
  });
});

describe("text", () => {
  it.each([
    ["a{null}b", '"ab"'],
    ['a{/* c */}{""}b', '"ab"'],
    ["a<></>b", '"ab"'],
    ["a <>b</>", '"a b"'],
    ['a{" "}b', '"a b"'],
    ['{"a"}{`b`}c', '"abc"'],
    ["a{label}b", '"a" {label} "b"'],
    ["a<>{label}c</>d", '"a" {label} "cd"'],
  ])("joins the texts side by side in %s", (children, expected) => {
    expect(lowered(children)).toBe(expected);
  });

  it("spans a joined text across its parts", () => {
    const { source, module } = component('<p>a{null}{"b"}</p>');
    const [text] = root(module).children;
    expect(source.slice(text!.span.start, text!.span.end)).toBe('a{null}{"b"}');
  });
});

describe("conditionals", () => {
  it.each([
    ["{on && <b>x</b>}", 'if(on: <b>"x"</b>)'],
    ["{count && <b>x</b>}", 'if(count: <b>"x"</b>)'],
    ['{count && "items"}', 'if(count: "items")'],
    ["{on ? <b>x</b> : <i>y</i>}", 'if(on: <b>"x"</b> | else: <i>"y"</i>)'],
    ['{on ? <b>x</b> : "y"}', 'if(on: <b>"x"</b> | else: "y")'],
    ["{on ? <b>x</b> : label}", 'if(on: <b>"x"</b> | else: {label})'],
    [
      '{count === 1 ? <b>one</b> : count === 2 ? "two" : count > 2 && <i>many</i>}',
      'if(count === 1: <b>"one"</b> | count === 2: "two" | count > 2: <i>"many"</i>)',
    ],
    ["{on ? <>a <b>b</b></> : <>c</>}", 'if(on: "a " <b>"b"</b> | else: "c")'],
    ["{on ? (count > 1 ? <b>x</b> : null) : null}", 'if(on: if(count > 1: <b>"x"</b>))'],
    ["{on ? <b>x</b> : null}", 'if(on: <b>"x"</b>)'],
    ["{on ? null : <b>x</b>}", 'if(on:  | else: <b>"x"</b>)'],
    ["{on ? <b>x</b> : count > 1 ? <i>y</i> : null}", 'if(on: <b>"x"</b> | count > 1: <i>"y"</i>)'],
    // Without JSX in either branch, a conditional is an expression rendered as text.
    ["{on ? null : undefined}", "{on ? null : undefined}"],
  ])("lowers %s", (child, expected) => {
    expect(lowered(child)).toBe(expected);
  });

  it.each(["{on && null}", '{on && ""}', "{on ? <>{null}</> : null}"])(
    "drops %s, which renders nothing in any branch",
    (child) => {
      expect(lowered(`a${child}b`)).toBe('"ab"');
    },
  );

  it.each([
    ["{maybe || <b>none</b>}", "||"],
    ["{maybe ?? <b>none</b>}", "??"],
  ])("reports %s as an unsupported conditional (UF3025)", (child, operator) => {
    const { source, diagnostics } = component(`<p>${child}</p>`, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3025 ${child.slice(1, -1)}`]);
    expect(diagnostics[0]!.message).toContain(`\`${operator}\` renders`);
  });

  it("still checks both sides of an unsupported conditional", () => {
    const { source, diagnostics } = component('<p>{lable || <b className="x">a</b>}</p>');
    expect(problems(source, diagnostics)).toEqual([
      'UF3025 lable || <b className="x">a</b>',
      "UF3020 lable",
      "UF3004 className",
    ]);
  });
});

describe("where text and expressions sit", () => {
  it.each([
    ["<table>{label}</table>", "UF3003"],
    ['<table><tbody>{on && <tr />}{on && "x"}</tbody></table>', "UF3003"],
    ["<select>{label}<option>a</option></select>", "UF3003"],
    ["<textarea>{label}</textarea>", "UF1002"],
    ["<textarea>{on && <b />}</textarea>", "UF1002"],
    ["<textarea>{items.map((item) => <b key={item} />)}</textarea>", "UF3003"],
  ])("reports the expression in %s", (jsx, code) => {
    const { diagnostics } = component(jsx, { props: PROPS });
    expect(codes(diagnostics)).toContain(code);
  });

  it("accepts static text in a textarea, and an element-only conditional in a table part", () => {
    expect(component("<textarea>a</textarea>").diagnostics).toEqual([]);
    expect(
      component("<table><tbody>{on && <tr><td>x</td></tr>}</tbody></table>", { props: PROPS })
        .diagnostics,
    ).toEqual([]);
  });

  it("checks placement through conditionals, lists and fragments", () => {
    for (const jsx of [
      "<table>{on && <tr />}</table>",
      "<table><>{on && <tr />}</></table>",
      "<table>{items.map((item) => <tr key={item} />)}</table>",
      "<select>{on && <div />}</select>",
      "<p>{on ? <div /> : null}</p>",
    ]) {
      expect(codes(component(jsx, { props: PROPS }).diagnostics), jsx).toContain("UF3003");
    }
  });

  it.each([
    ['<pre>{"\\nx"}</pre>', '"\\nx"'],
    ['<pre>{""}{"\\nx"}</pre>', '"\\nx"'],
    ['<textarea>{"\\nx"}</textarea>', '"\\nx"'],
    ['<pre>{on && "\\nx"}</pre>', '"\\nx"'],
  ])("reports the leading line feed in %s (UF3017)", (jsx, at) => {
    const { source, diagnostics } = component(jsx, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3017 ${at}`]);
  });

  it("accepts a line feed after the start", () => {
    expect(component('<pre>a{"\\nb"}</pre>').diagnostics).toEqual([]);
    expect(component('<pre>{label}{"\\n"}{label}</pre>', { props: PROPS }).diagnostics).toEqual([]);
  });

  it.each([
    ['<table>{" "}<tbody /></table>', "table"],
    ['<div><select>{" "}<option>a</option></select></div>', "select"],
  ])("removes the whitespace a string writes in %s", (jsx) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3003"]);
    expect(applyAndRecheck(source, diagnostics)).not.toContain('{" "}');
  });
});

describe("the root", () => {
  it("lowers a root fragment, each of whose elements is a component root", () => {
    const { module, diagnostics } = run(
      "export function A({ on }: { on: boolean }) { return <><h2>a</h2>{on && <p>b</p>}text</>; }",
    );
    expect(diagnostics).toEqual([]);
    const render = only(module).render;
    expect(render.kind).toBe("Fragment");
    expect(render.kind === "Fragment" && shape(render.children)).toBe(
      '<h2>"a"</h2> if(on: <p>"b"</p>) "text"',
    );
    expect(codes(run("export function A() { return <><tr /></>; }").diagnostics)).toEqual([
      "UF3003",
    ]);
  });

  it.each([
    "on ? <p>a</p> : <p>b</p>",
    "on && <p>a</p>",
    "items.map((item) => <p key={item}>{item}</p>)",
  ])("reports a returned %s, and its fix wraps it in a fragment", (returned) => {
    const source = `export function A({ on, items }: { on: boolean; items: string[] }) { return ${returned}; }`;
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1102"]);
    expect(diagnostics[0]!.fixes).toEqual([expect.objectContaining({ confidence: "likely" })]);
    expect(applyAndRecheck(source, diagnostics)).toContain(`return <>{${returned}}</>;`);
  });

  it("checks a returned conditional's content, so the fix reveals nothing new", () => {
    const source = 'export function A() { return lable ? <p className="x">a</p> : null; }';
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF1102", "UF3020", "UF3004"]);
    applyAndRecheck(source, diagnostics);
  });
});
