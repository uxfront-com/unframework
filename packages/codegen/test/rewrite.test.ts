import {
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createExpression,
  createFor,
  createInterpolation,
  createProp,
  createPropsParameter,
  createTypeText,
  span,
} from "@unframework/ir";
import type { Binding, Expression, UfComponent } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  bindingOf,
  expressionNames,
  needsParentheses,
  parseExpression,
  parseExpressionSource,
  referencedBindings,
  rewriteExpression,
} from "../src/index.ts";
import type { RewriteRules } from "../src/index.ts";
import { expressionAt } from "./expressions.ts";
import type { ReferenceTarget } from "./expressions.ts";

// Expressions sit at offset 100 of an imaginary source, so a rewrite that forgets the
// expression's own offset splices in the wrong place.
const BASE = 100;

// The component's bindings: two destructured props, a loop item and its index.
const label = createBinding("label", "prop", span(10, 15));
const tone = createBinding("tone", "prop", span(17, 21));
const item = createBinding("item", "loopVar", span(60, 64));
const index = createBinding("index", "loopVar", span(66, 71));
const bindings: Binding[] = [label, tone, item, index];

/** An expression at {@link BASE}: see {@link expressionAt}. */
const expression = (code: string, ...refs: ReferenceTarget[]): Expression =>
  expressionAt(BASE, code, ...refs);

function component(...expressions: Expression[]): UfComponent {
  const render = createElement(
    "p",
    [],
    expressions.map((value) => createInterpolation(value, value.span)),
    span(0, 200),
  );
  return createComponent("Badge", render, span(0, 300), [], undefined, [], bindings);
}

/** Solid's rules: every prop reads through `props`, and the index is an accessor. */
const solid: RewriteRules = {
  binding: (_, binding, written) =>
    binding.kind === "prop" ? `props.${binding.name}` : binding === index ? "index()" : written,
};

describe("rewriteExpression", () => {
  it("splices each kind of reference at its span and keeps the rest as written", () => {
    const value = expression(
      "label.toUpperCase() + tone /* the tone */ + item.name + index + Math.max(1000, 0.50)",
      ["label", label],
      ["tone", tone],
      ["item", item],
      ["index", index],
      ["Math", "Global"],
    );
    expect(rewriteExpression(value, component(value), solid)).toBe(
      "props.label.toUpperCase() + props.tone /* the tone */ + item.name + index() + Math.max(1000, 0.50)",
    );
  });

  it("returns the code itself when nothing is respelled", () => {
    const value = expression("label ?? `${tone}`", ["label", label], ["tone", tone]);
    const asWritten: RewriteRules = { binding: (_, __, written) => written };
    expect(rewriteExpression(value, component(value), asWritten)).toBe(value.code);
    const literal = expression("1_000 + 0x10 + 1e21");
    expect(rewriteExpression(literal, component(literal), solid)).toBe("1_000 + 0x10 + 1e21");
  });

  it("expands a shorthand property only when its spelling changes", () => {
    const value = expression("String({ label, tone: tone })", ["label", label], ["tone", tone]);
    expect(value.refs[0]).toMatchObject({ shorthand: true });
    expect(value.refs[1]).not.toHaveProperty("shorthand");
    expect(rewriteExpression(value, component(value), solid)).toBe(
      "String({ label: props.label, tone: props.tone })",
    );
    const asWritten: RewriteRules = { binding: (_, __, written) => written };
    expect(rewriteExpression(value, component(value), asWritten)).toBe(value.code);
  });

  it("replaces the whole `props.x` of the object form", () => {
    const value = expression(
      "props.label + props.tone",
      ["props.label", label],
      ["props.tone", tone],
    );
    // Angular's rules: each input is a signal, called.
    const angular: RewriteRules = { binding: (_, binding) => `${binding.name}()` };
    expect(rewriteExpression(value, component(value), angular)).toBe("label() + tone()");
  });

  it("spells globals by their own rule, expanding a shorthand global", () => {
    const value = expression(
      "Math.round(NaN) + String({ NaN })",
      ["Math", "Global"],
      ["NaN", "Global"],
      ["NaN", "Global"],
    );
    expect(rewriteExpression(value, component(value), solid)).toBe(value.code);
    const members: RewriteRules = {
      binding: (_, __, written) => written,
      global: (reference) => `this.${reference.name}`,
    };
    expect(rewriteExpression(value, component(value), members)).toBe(
      "this.Math.round(this.NaN) + String({ NaN: this.NaN })",
    );
  });

  it("leaves the parameters of nested arrow functions alone", () => {
    const value = expression(
      "items.filter((entry) => entry.on && entry.tone === tone).map((entry) => entry.label)",
      ["tone", tone],
    );
    expect(rewriteExpression(value, component(value), solid)).toBe(
      "items.filter((entry) => entry.on && entry.tone === props.tone).map((entry) => entry.label)",
    );
  });

  it("keeps comments, line breaks and literals exactly", () => {
    const code = [
      "label // the label",
      '  + "a\\x41\\u00e9" + `b${tone}c` /* a block',
      "  comment */ + 1000 + .5 + /[a-z]+/g.source",
    ].join("\n");
    const value = expression(code, ["label", label], ["tone", tone]);
    expect(rewriteExpression(value, component(value), solid)).toBe(
      code.replace("label", "props.label").replace("${tone}", "${props.tone}"),
    );
  });

  it("rejects references the component does not declare, or outside the expression", () => {
    const stranger = createBinding("stranger", "prop", span(1, 9));
    const unknown = expression("stranger", ["stranger", stranger]);
    expect(() => rewriteExpression(unknown, component(unknown), solid)).toThrow(
      "declares no binding stranger@1",
    );
    const outside = createExpression("label", span(BASE, BASE + 5), [
      createBindingReference(label.id, span(BASE + 3, BASE + 9)),
    ]);
    expect(() => rewriteExpression(outside, component(outside), solid)).toThrow("outside");
    const overlapping = createExpression("label", span(BASE, BASE + 5), [
      createBindingReference(label.id, span(BASE, BASE + 5)),
      createBindingReference(label.id, span(BASE + 2, BASE + 4)),
    ]);
    expect(() => rewriteExpression(overlapping, component(overlapping), solid)).toThrow("overlaps");
  });

  it("finds bindings by id", () => {
    expect(bindingOf(component(), "tone@17")).toBe(tone);
    expect(() => bindingOf(component(), "tone@18")).toThrow("declares no binding tone@18");
  });
});

describe("parseExpression", () => {
  it("parses one expression with offsets relative to its code", () => {
    const parsed = parseExpressionSource("a /* b */ + c // d");
    expect(parsed.expression).toMatchObject({ type: "BinaryExpression", start: 0, end: 13 });
    expect(parsed.comments.map(({ type, start, end }) => [type, start, end])).toEqual([
      ["Block", 2, 9],
      ["Line", 14, 18],
    ]);
    expect(parseExpression("{ a: 1 }")).toMatchObject({ type: "ObjectExpression", start: 0 });
    expect(parseExpression("(a || b)")).toMatchObject({ type: "LogicalExpression", start: 1 });
  });

  it.each([
    ["", "empty"],
    ["a) + (b", "closes the wrapper's parenthesis"],
    ["a)(b", "calls through the wrapper"],
    ["a); (b", "two statements"],
    ["a +", "incomplete"],
    ["<p>", "unclosed JSX"],
  ])("rejects %j (%s)", (code) => {
    expect(() => parseExpression(code)).toThrow("Cannot parse");
  });
});

describe("needsParentheses", () => {
  it.each([
    // Operands: anything that binds less tightly than a member access.
    ["a", "operand", false],
    ["a.b[c](d)", "operand", false],
    ["`a${b}`", "operand", false],
    ['"a"', "operand", false],
    ["[a, b]", "operand", false],
    ["(a || b)", "operand", false],
    ["a || b", "operand", true],
    ["a ?? []", "operand", true],
    ["!a", "operand", true],
    ["-1", "operand", true],
    ["1000", "operand", true],
    ["a?.b", "operand", true],
    ["(a) + (b)", "operand", true],
    // A conditional's test: only what binds no tighter than a conditional.
    ["a || b", "test", false],
    ["a?.b", "test", false],
    ["a ? b : c", "test", true],
    ["(a ? b : c)", "test", false],
    ["(x) => x", "test", true],
    // Arguments, elements and containers take anything but a sequence.
    ["a ? b : c", "argument", false],
    ["a, b", "argument", true],
  ] as const)("%j as %s: %s", (code, slot, expected) => {
    expect(needsParentheses(code, slot)).toBe(expected);
  });

  it("judges operands by default", () => {
    expect(needsParentheses("a + b")).toBe(true);
    expect(needsParentheses("a.b")).toBe(false);
  });
});

describe("referencedBindings", () => {
  const key = expression("item.id + index", ["item", item], ["index", index]);
  const body = createElement(
    "li",
    [createBoundAttribute("title", expression("tone", ["tone", tone]), span(0, 1))],
    [createInterpolation(expression("item.name", ["item", item]), span(0, 1))],
    span(0, 1),
  );
  const list = createFor(
    expression("items", ["items", "Global"]),
    item.id,
    key,
    body,
    span(0, 1),
    index.id,
  );
  const withProps = (render: UfComponent["render"]) =>
    createComponent(
      "Badge",
      render,
      span(0, 1),
      [
        createProp("label", false, createTypeText("string", span(0, 1)), span(0, 1), label.id),
        createProp("tone", false, createTypeText("string", span(0, 1)), span(0, 1), tone.id),
      ],
      createPropsParameter("destructured", createTypeText("P", span(0, 1)), span(0, 1)),
      [],
      bindings,
    );

  it("collects the bindings every printed expression references", () => {
    const render = createElement("ul", [], [list], span(0, 1));
    expect([...referencedBindings(withProps(render))].toSorted()).toEqual(
      [index.id, item.id, tone.id].toSorted(),
    );
  });

  it("leaves out what only a list's key references, for targets that print no key", () => {
    const render = createElement("ul", [], [list], span(0, 1));
    expect([...referencedBindings(withProps(render), { includeKeys: false })].toSorted()).toEqual(
      [item.id, tone.id].toSorted(),
    );
  });

  it("looks into class parts and a single node", () => {
    const classed = createElement(
      "p",
      [
        createClassAttribute(
          [createDynamicClass(expression("label", ["label", label]), span(0, 1))],
          span(0, 1),
        ),
      ],
      [],
      span(0, 1),
    );
    expect([...referencedBindings(withProps(classed))]).toEqual([label.id]);
    expect([...referencedBindings(list, { includeKeys: false })].toSorted()).toEqual(
      [item.id, tone.id].toSorted(),
    );
  });
});

describe("expressionNames", () => {
  it("collects variables and parameters, not member or property names", () => {
    expect(
      [...expressionNames("a.b + c[d] + f({ g: h, i, [j]: k }, (l) => l.m)")].toSorted(),
    ).toEqual(["a", "c", "d", "f", "h", "i", "j", "k", "l"]);
  });
});
