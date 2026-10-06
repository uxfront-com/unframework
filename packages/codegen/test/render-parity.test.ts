// The render-parity kit is what every target's parity test trusts, so its parser, its comparison
// and its model of the IR's DOM are tested here: a lenient parser would pass outputs that differ.
// The reference evaluator and the source cases have tests of their own
// (render-parity-reference.test.ts, render-parity-sources.test.ts).
import {
  checkInvariants,
  createFragment,
  createText,
  DRAFT_ARIA_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  isBooleanAttribute,
  PERMITTED_CHILDREN,
  REPAIRED_DESCENDANTS,
  REQUIRED_PARENTS,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_ELEMENTS,
  SVG_GLOBAL_ATTRIBUTES,
  TEXTLESS_ELEMENTS,
  UNBINDABLE_ATTRIBUTES,
  UNDECLARED_ATTRIBUTES,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { ElementNode, FragmentNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { defineTarget, htmlDialect, printMarkup, vueDialect } from "../src/index.ts";
import type { CapabilityCell, CapabilityName, Target } from "../src/index.ts";
import {
  attributeSweep,
  boundAttributeSweep,
  clientParitySuites,
  emitParity,
  parityModule,
  paritySuites,
  SUBMISSION_OVERRIDES,
  sweepDrops,
  unsupportedCapabilities,
} from "./render-parity-node.ts";
import {
  CARRIAGE_RETURN_CASES,
  comparableValue,
  compareCases,
  compareRendered,
  domNodesOf,
  domOf,
  el,
  FUZZ_CASES,
  fuzzCase,
  parseHtml,
  TRICKY_CASES,
} from "./render-parity.ts";

const at = { start: 0, end: 0 };

describe("parseHtml", () => {
  it("reads elements, attributes and text, and decodes references", () => {
    expect(
      parseHtml(
        `<DIV Title="a &amp; &quot;b&quot;" data-x='c' hidden><p>x &lt; y &#123;&#x7d;&nbsp;</p><br/><img src=z></DIV>`,
      ),
    ).toEqual([
      {
        tag: "div",
        attributes: { title: 'a & "b"', "data-x": "c", hidden: "" },
        children: [
          { tag: "p", attributes: {}, children: ["x < y {}\u00a0"] },
          { tag: "br", attributes: {}, children: [] },
          { tag: "img", attributes: { src: "z" }, children: [] },
        ],
      },
    ]);
  });

  it("drops comments and merges the text around them, but keeps whitespace text", () => {
    expect(parseHtml("<p>a<!--[-->b<!--]--> <b>c</b>\n</p>")).toEqual([
      {
        tag: "p",
        attributes: {},
        children: ["ab ", { tag: "b", attributes: {}, children: ["c"] }, "\n"],
      },
    ]);
  });

  it("drops the line feed right after <pre> and <textarea>, as HTML does, and keeps a raw CR", () => {
    expect(parseHtml("<pre>\n\na\rb</pre><textarea>\nc</textarea>")).toEqual([
      { tag: "pre", attributes: {}, children: ["\na\rb"] },
      { tag: "textarea", attributes: {}, children: ["c"] },
    ]);
  });

  it("leaves out the attributes it is told to", () => {
    expect(
      parseHtml('<p data-hk="0-1" id="x">a</p>', { ignoreAttribute: (n) => n === "data-hk" }),
    ).toEqual([{ tag: "p", attributes: { id: "x" }, children: ["a"] }]);
  });

  it("treats HTML's boolean attributes by their presence", () => {
    expect(parseHtml('<input disabled="disabled" readonly="" required>')).toEqual([
      { tag: "input", attributes: { disabled: "", readonly: "", required: "" }, children: [] },
    ]);
    expect(parseHtml('<div hidden="until-found"></div>')).toEqual([
      { tag: "div", attributes: { hidden: "until-found" }, children: [] },
    ]);
  });

  it.each([
    ["<p>a</b>", "</b> closes <p>"],
    ["<p>a", "<p> is never closed"],
    ["<p>&copy;</p>", "unexpected entity &copy;"],
    ["<p>&amp</p>", "unexpected entity &amp"],
    ["<p>a < b</p>", "a stray <"],
    ["<div/>", "<div/> is not a void element"],
    ["<!-- open", "unterminated comment"],
    ["<svg><p>x</p></svg>", "<p> inside <svg>"],
    ["<svg><circle></svg>", "</svg> closes <circle>"],
  ])("refuses %j rather than guessing", (html, message) => {
    expect(() => parseHtml(html)).toThrow(message);
  });

  // Serialisers write SVG's names in their case and may close childless elements themselves
  // (Astro, Vue); the HTML parser reads them so, restoring the case only of the names its
  // tables list, and only in SVG.
  it("reads foreign elements: self-closing, with SVG's case restored", () => {
    expect(
      parseHtml(
        '<svg VIEWBOX="0 0 2 2" data-x="y"><LinearGradient gradientunits="a"><stop offset="0"/></LinearGradient><circle r="1"/><rect></rect></svg><lineargradient></lineargradient>',
      ),
    ).toEqual([
      {
        tag: "svg",
        attributes: { viewBox: "0 0 2 2", "data-x": "y" },
        children: [
          {
            tag: "linearGradient",
            attributes: { gradientUnits: "a" },
            children: [{ tag: "stop", attributes: { offset: "0" }, children: [] }],
          },
          { tag: "circle", attributes: { r: "1" }, children: [] },
          { tag: "rect", attributes: {}, children: [] },
        ],
      },
      // Outside SVG, a camel-case name is just lower case.
      { tag: "lineargradient", attributes: {}, children: [] },
    ]);
  });

  it("reads a self-closing <svg> and no line feed rule inside SVG", () => {
    expect(parseHtml("<p><svg/>x</p><svg><text>\na</text></svg>")).toEqual([
      { tag: "p", attributes: {}, children: [{ tag: "svg", attributes: {}, children: [] }, "x"] },
      {
        tag: "svg",
        attributes: {},
        children: [{ tag: "text", attributes: {}, children: ["\na"] }],
      },
    ]);
  });

  it("restores the case of every SVG name the IR holds", () => {
    const camel = [...SVG_ELEMENTS].filter((tag) => tag !== tag.toLowerCase());
    for (const tag of camel) {
      expect(parseHtml(`<svg><${tag.toLowerCase()}/></svg>`), tag).toEqual([
        { tag: "svg", attributes: {}, children: [{ tag, attributes: {}, children: [] }] },
      ]);
    }
    const attributes = [
      ...SVG_GLOBAL_ATTRIBUTES,
      ...[...SVG_ELEMENT_ATTRIBUTES.values()].flatMap((names) => [...names]),
    ].filter((name) => name !== name.toLowerCase());
    expect(attributes.length).toBeGreaterThan(20);
    for (const name of attributes) {
      const [svg] = parseHtml(`<svg ${name.toLowerCase()}="1"></svg>`);
      expect(svg, name).toEqual({ tag: "svg", attributes: { [name]: "1" }, children: [] });
    }
  });
});

// Design §6.4 (ADR-0044): what frameworks write differently for the same DOM state, and only
// that, is made the same on both sides of every comparison.
describe("comparableValue", () => {
  it("compares a class by its tokens, sorted, and drops one with none", () => {
    expect(comparableValue("class", " b\ta  c ")).toBe("a b c");
    expect(comparableValue("class", "")).toBeUndefined();
    expect(comparableValue("class", " \n ")).toBeUndefined();
  });

  it("keeps a doubled class token, which a broken merge makes", () => {
    expect(comparableValue("class", "a b a")).toBe("a a b");
    expect(comparableValue("class", "a b a")).not.toBe(comparableValue("class", "a b"));
  });

  it("compares a style by its declarations, sorted, and drops empty ones", () => {
    expect(comparableValue("style", "margin-top:4px;COLOR: red ;")).toBe(
      "color: red; margin-top: 4px;",
    );
    expect(comparableValue("style", "color:;margin-top: 4px")).toBe("margin-top: 4px;");
    expect(comparableValue("style", "color: ;")).toBeUndefined();
    expect(comparableValue("style", "")).toBeUndefined();
    expect(comparableValue("style", "--Gap: a  b; content: 'x;  y'")).toBe(
      "--Gap: a b; content: 'x; y';",
    );
  });

  it("keeps the order of declarations whose order decides what renders", () => {
    expect(comparableValue("style", "margin-top: 1px; margin: 0")).toBe(
      "margin-top: 1px; margin: 0;",
    );
    expect(comparableValue("style", "color: red; color: blue")).toBe("color: red; color: blue;");
    expect(comparableValue("style", "color: red; color: blue")).not.toBe(
      comparableValue("style", "color: blue; color: red"),
    );
  });

  it("keeps what is not formatting: values as written, a declaration without a colon", () => {
    expect(comparableValue("style", "margin-top: 0")).not.toBe(
      comparableValue("style", "margin-top: 0px"),
    );
    expect(comparableValue("style", "color red")).toBe("color red;");
    expect(comparableValue("style", "color: red !important")).toBe("color: red !important;");
  });

  it("compares HTML's boolean attributes by presence, and SVG's attributes as written", () => {
    expect(comparableValue("disabled", "disabled")).toBe("");
    expect(comparableValue("hidden", "until-found")).toBe("until-found");
    expect(comparableValue("disabled", "disabled", "svg")).toBe("disabled");
  });
});

describe("domOf", () => {
  it("is the IR's DOM: exact text, empty values for attributes without one", () => {
    expect(
      domOf(el("p", { title: "a  b", "data-on": true, disabled: "disabled" }, " x ", "y")),
    ).toEqual({
      tag: "p",
      attributes: { title: "a  b", "data-on": "", disabled: "" },
      children: [" x y"],
    });
  });

  it("keeps SVG's names as written, and compares class and style as §6.4 says", () => {
    expect(
      domOf(
        el(
          "svg",
          { viewBox: "0 0 1 1", class: "b a" },
          el("linearGradient", { gradientUnits: "x", style: "" }),
        ),
      ),
    ).toEqual({
      tag: "svg",
      attributes: { viewBox: "0 0 1 1", class: "a b" },
      children: [{ tag: "linearGradient", attributes: { gradientUnits: "x" }, children: [] }],
    });
  });

  it("reads a root fragment's nodes, merging adjacent text", () => {
    expect(
      domNodesOf(createFragment([createText("a", at), createText("b", at), el("i")], at)),
    ).toEqual(["ab", { tag: "i", attributes: {}, children: [] }]);
  });
});

describe("compareCases", () => {
  const suite = { title: "one", cases: [{ name: "one", render: el("p", {}, "a") }] };

  it("pairs each case with the root's child at its index", () => {
    const [root, first] = compareCases(parseHtml("<div><p>a</p></div>"), suite);
    expect(root).toEqual({
      name: "the root's children, one element per case",
      expected: ["<p>"],
      actual: ["<p>"],
    });
    expect(first).toEqual({
      name: "one",
      expected: domOf(suite.cases[0]!.render),
      actual: first!.actual,
    });
    expect(first!.actual).toEqual(first!.expected);
  });

  it("names whitespace a compiler left between the cases", () => {
    const [root] = compareCases(parseHtml("<div> <p>a</p></div>"), suite);
    expect(root!.actual).toEqual(['" "', "<p>"]);
  });

  it("refuses output that is not the parity root", () => {
    expect(() => compareCases(parseHtml("<p>a</p>"), suite)).toThrow("expected one root <div>");
  });

  it("compares a root case with the component's whole output", () => {
    const expected = [{ name: "root", nodes: ["a", domOf(el("b", {}, "x"))] }];
    const [outline, result] = compareRendered(parseHtml("a<!----><b>x</b>"), "self", expected);
    expect(outline).toEqual({
      name: "the component's root nodes",
      expected: ['"a"', "<b>"],
      actual: ['"a"', "<b>"],
    });
    expect(result!.actual).toEqual(result!.expected);
    const [, extra] = compareRendered(parseHtml("a <b>x</b>"), "self", expected);
    expect(extra!.actual).not.toEqual(extra!.expected);
    expect(() => compareRendered([], "self", [...expected, ...expected])).toThrow("one case");
  });
});

/** Every element of a tree, with its parent and its ancestors, outermost first. */
function* elements(
  node: ElementNode,
  ancestors: readonly ElementNode[] = [],
): Generator<{ node: ElementNode; ancestors: readonly ElementNode[] }> {
  yield { node, ancestors };
  for (const child of node.children) {
    if (child.kind === "Element") yield* elements(child, [...ancestors, node]);
  }
}

describe("the cases", () => {
  it("are deterministic: a seed always gives the same tree", () => {
    expect(fuzzCase(7)).toEqual(fuzzCase(7));
    expect(fuzzCase(7)).not.toEqual(fuzzCase(8));
    expect(FUZZ_CASES).toHaveLength(80);
  });

  // What a target emits from must be IR the compiler would hand it. The carriage returns are the
  // exception on purpose: the IR holds none (ADR-0030), and they test the printers' escapes.
  it("are valid IR, but for the carriage returns", () => {
    const problems = paritySuites()
      .filter(({ cases }) => cases !== CARRIAGE_RETURN_CASES && !cases[0]?.lowered)
      .flatMap(({ cases }) => cases)
      .flatMap((parityCase) =>
        checkInvariants(parityModule({ title: parityCase.name, cases: [parityCase] })).map(
          ({ path, message }) => `${parityCase.name}: ${path} ${message}`,
        ),
      );
    expect(problems).toEqual([]);
  });

  it("keep to the nesting the HTML parser leaves in place", () => {
    const problems: string[] = [];
    for (const { name, render } of [...TRICKY_CASES, ...FUZZ_CASES]) {
      for (const { node, ancestors } of elements(render)) {
        const parent = ancestors.at(-1);
        const required = REQUIRED_PARENTS.get(node.tag);
        if (required && !required.has(parent?.tag ?? "")) {
          problems.push(`${name}: <${node.tag}> in <${parent?.tag}>`);
        }
        const permitted = PERMITTED_CHILDREN.get(parent?.tag ?? "");
        if (permitted && !permitted.has(node.tag)) {
          problems.push(`${name}: <${node.tag}> in <${parent!.tag}>`);
        }
        if (TEXTLESS_ELEMENTS.has(node.tag) && node.children.some((c) => c.kind === "Text")) {
          problems.push(`${name}: text in <${node.tag}>`);
        }
        // The parser closes or drops an element inside one of these, unless a reset comes between.
        for (const [index, ancestor] of ancestors.entries()) {
          const rule = REPAIRED_DESCENDANTS.get(ancestor.tag);
          const between = ancestors.slice(index + 1);
          if (rule?.descendants.has(node.tag) && !between.some((b) => rule.resetBy?.has(b.tag))) {
            problems.push(`${name}: <${node.tag}> inside <${ancestor.tag}>`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("make the random trees as varied as the printers' hard parts", () => {
    const tags = new Set<string>();
    const found = new Set<string>();
    for (const { render } of FUZZ_CASES) {
      for (const { node, ancestors } of elements(render)) {
        tags.add(node.tag);
        if (
          node.attributes.some(
            (attribute) => attribute.kind === "Static" && isBooleanAttribute(attribute.name),
          )
        ) {
          found.add("a boolean attribute");
        }
        if (printMarkup({ ...node, children: [] }, vueDialect).split("\n").length > 2) {
          found.add("a tag longer than a line");
        }
        if (node.tag !== "br" && ancestors.some((ancestor) => ancestor.tag === "pre")) {
          found.add("an element inside <pre>");
        }
        if (
          node.children.some((child) => child.kind === "Text" && child.value.includes("\u200b"))
        ) {
          found.add("a zero-width space");
        }
      }
    }
    for (const tag of "ul ol li table tbody tr td th select option optgroup pre br wbr img input textarea button label".split(
      " ",
    )) {
      expect(tags, tag).toContain(tag);
    }
    expect([...found].toSorted()).toEqual([
      "a boolean attribute",
      "a tag longer than a line",
      "a zero-width space",
      "an element inside <pre>",
    ]);
  });

  it("start no <pre> or <textarea> with a line feed, which most targets lose", () => {
    for (const { name, render } of FUZZ_CASES) {
      for (const { node } of elements(render)) {
        if (node.tag !== "pre" && node.tag !== "textarea") continue;
        const [first] = node.children;
        expect(first?.kind === "Text" && first.value.startsWith("\n"), name).toBe(false);
      }
    }
  });

  it("never put two text nodes side by side, as the IR never does", () => {
    const check = (node: ReturnType<typeof el>): void => {
      node.children.forEach((child, index) => {
        if (child.kind === "Element") check(child);
        else expect(node.children[index - 1]?.kind).not.toBe("Text");
      });
    };
    for (const { render } of [...TRICKY_CASES, ...FUZZ_CASES, ...CARRIAGE_RETURN_CASES]) {
      check(render);
    }
  });
});

/** A test target whose matrix supports everything but `unsupported`. */
function testTarget(emit: Target["emit"], unsupported?: CapabilityName): Target {
  const cell = (capability: CapabilityName): CapabilityCell =>
    capability === unsupported
      ? { support: "unsupported", code: "UF4001", severity: "error", reason: "A test." }
      : { support: "native" };
  return defineTarget({
    name: "test",
    framework: { package: "none", range: "*" },
    capabilities: {
      element: cell("element"),
      text: cell("text"),
      "static-attribute": cell("static-attribute"),
      listbox: cell("listbox"),
      interactivity: cell("interactivity"),
      props: cell("props"),
      interpolation: cell("interpolation"),
      conditional: cell("conditional"),
      list: cell("list"),
      fragment: cell("fragment"),
      "bound-attribute": cell("bound-attribute"),
      "class-binding": cell("class-binding"),
      "style-binding": cell("style-binding"),
      "attribute-spread": cell("attribute-spread"),
      svg: cell("svg"),
    },
    emit,
  });
}

const printed: Target["emit"] = (component) => [
  { path: "X.html", contents: printMarkup(component.render, htmlDialect) },
];

describe("emitParity", () => {
  /** A target that reports every `<select>` it emits. */
  const reporting = testTarget((component, context) => {
    const visit = (node: ElementNode | FragmentNode): void => {
      if (node.kind === "Element" && node.tag === "select") {
        context.report({ code: "UF4001", severity: "error", message: "no", span: node.span });
      }
      for (const child of node.children) if (child.kind === "Element") visit(child);
    };
    visit(component.render);
    return printed(component, context);
  });
  const select = { name: "a select", render: el("div", {}, el("select")) };
  const paragraph = { name: "a paragraph", render: el("p", {}, "x") };

  it("emits the cases when the target reports nothing", async () => {
    const [file] = await emitParity(
      reporting,
      { title: "a suite", cases: [paragraph] },
      { format: false },
    );
    expect(file!.contents).toBe("<div><p>x</p></div>");
  });

  it("emits a root case as the component's root", async () => {
    const [file] = await emitParity(
      reporting,
      { title: "a root", root: "self", cases: [paragraph] },
      { format: false },
    );
    expect(file!.contents).toBe("<p>x</p>");
  });

  // What a target cannot render exactly, its capability matrix declares instead.
  it("fails on anything the target reports", async () => {
    await expect(
      emitParity(reporting, { title: "a suite", cases: [paragraph, select] }, { format: false }),
    ).rejects.toThrow("test reported UF4001 (no) for a suite.");
  });
});

describe("unsupportedCapabilities", () => {
  const cases = paritySuites().flatMap(({ cases: listed }) => listed);

  it("names what a case uses that the target's matrix marks unsupported", () => {
    const target = testTarget(printed, "listbox");
    // A bound `size` makes a list box too, while the analyzer accepts one (the sweep follows it).
    const bound = boundAttributeSweep()
      .filter(({ name }) => name.startsWith("<select size> ="))
      .map(({ name }) => name);
    expect(
      cases
        .filter((parityCase) => unsupportedCapabilities(target, parityCase).length)
        .map(({ name }) => name),
    ).toEqual([
      "a single-selection list box",
      "a single-selection list box of option groups",
      "<select size>",
      ...bound,
    ]);
    expect(unsupportedCapabilities(target, TRICKY_CASES[0]!)).toEqual([]);
    expect(unsupportedCapabilities(testTarget(printed, "text"), TRICKY_CASES[0]!)).toEqual([
      "text",
    ]);
  });

  it("reads a source case's capabilities from its own component", () => {
    const sweep = boundAttributeSweep();
    const disabled = sweep.find(({ name }) => name === "<input disabled> = true")!;
    expect(unsupportedCapabilities(testTarget(printed, "bound-attribute"), disabled)).toEqual([
      "bound-attribute",
    ]);
    expect(unsupportedCapabilities(testTarget(printed, "props"), disabled)).toEqual(["props"]);
    expect(unsupportedCapabilities(testTarget(printed, "svg"), disabled)).toEqual([]);
  });

  it("names nothing on a target that supports every capability", () => {
    const target = testTarget(printed);
    expect(cases.flatMap((parityCase) => unsupportedCapabilities(target, parityCase))).toEqual([]);
  });
});

describe("the attribute sweep", () => {
  const sweep = attributeSweep();

  it("renders every pair the analyzer accepts once, each in its own <div>", () => {
    expect(sweep.length).toBeGreaterThan(400);
    expect(new Set(sweep.map(({ name }) => name)).size).toBe(sweep.length);
    expect(sweep.every(({ render }) => render.tag === "div" && render.children.length === 1)).toBe(
      true,
    );
  });

  it("puts each element where HTML requires it and every input type that takes a value", () => {
    const names = sweep.map(({ name }) => name);
    for (const name of [
      "<td colspan>",
      "<option value>",
      '<input type="submit" value>',
      "<div aria-label>",
    ]) {
      expect(names).toContain(name);
    }
    // Form state, which the analyzer rejects until `v-model`: no target is asked to render it.
    for (const name of ["<input value>", "<option selected>"]) {
      expect(names).not.toContain(name);
    }
  });

  it("renders every SVG element and SVG's attributes in an <svg>, with their case", () => {
    const names = new Set(sweep.map(({ name }) => name));
    for (const tag of SVG_ELEMENTS) expect(names, tag).toContain(`<svg:${tag}>`);
    for (const name of [
      "<svg:svg viewBox>",
      "<svg:linearGradient gradientUnits>",
      "<svg:rect stroke-width>",
      "<svg:feGaussianBlur stdDeviation>",
    ]) {
      expect(names).toContain(name);
    }
    const gradient = sweep.find(({ name }) => name === "<svg:linearGradient gradientUnits>")!;
    expect(printMarkup(gradient.render, htmlDialect)).toBe(
      '<div><svg><linearGradient gradientUnits="userSpaceOnUse" /></svg></div>',
    );
  });

  it("gives an element the content its attributes act on", () => {
    const listbox = sweep.find(({ name }) => name === "<select size>")!;
    expect(printMarkup(listbox.render, htmlDialect)).toBe(
      '<div><select size="2"><option>a</option></select></div>',
    );
    const group = sweep.find(({ name }) => name === "<optgroup disabled>")!;
    expect(printMarkup(group.render, htmlDialect)).toBe(
      "<div><select><optgroup disabled><option>a</option></optgroup></select></div>",
    );
  });
});

describe("the bound attribute sweep", () => {
  const sweep = boundAttributeSweep();

  it("binds every pair the analyzer accepts to a prop, each in its own <div>", () => {
    expect(sweep.length).toBeGreaterThan(400);
    expect(new Set(sweep.map(({ name }) => name)).size).toBe(sweep.length);
    for (const { name, render, lowered } of sweep) {
      expect(render.kind === "Element" && render.tag === "div", name).toBe(true);
      expect(
        lowered!.component.props.map((prop) => prop.name),
        name,
      ).toEqual(["value"]);
    }
  });

  it("binds each kind of attribute to the values its rules cover", () => {
    const names = new Set(sweep.map(({ name }) => name));
    for (const name of [
      "<input disabled> = true",
      "<input disabled> = false",
      "<details open> = true",
      "<div aria-hidden> = true",
      "<div aria-hidden> = false",
      "<div spellcheck> = false",
      "<div tabindex> = 2",
      "<td colspan> = 2",
      '<a href> = "about:blank"',
      '<div title> = "x"',
      '<div data-x> = "x"',
      '<svg:svg viewBox> = "1"',
      '<svg:rect stroke-width> = "1"',
    ]) {
      expect(names).toContain(name);
    }
    // Not bindable in M1 (design §1.5): Angular refuses them, or they bypass its checks.
    for (const name of ['<iframe src> = "about:blank"', "<div hidden> = true"]) {
      expect(names).not.toContain(name);
    }
  });
});

/**
 * What the sweeps may leave out, by the analyzer's code, and why: every (element, attribute)
 * pair the vocabulary lists is rendered unless a rule below names it, so no attribute drops out
 * of the sweeps silently (when the analyzer's values or rules change, this list must too).
 */
const LEFT_OUT: readonly { reason: string; code: string; pairs: readonly string[] }[] = [
  {
    reason: "the element belongs to the document or to template syntax (UNRENDERABLE_ELEMENTS)",
    code: "UF3002",
    pairs: [...UNRENDERABLE_ELEMENTS.keys()].flatMap((tag) => [
      `<${tag}>`,
      ...[...(ELEMENT_ATTRIBUTES.get(tag) ?? [])].map((name) => `<${tag} ${name}>`),
    ]),
  },
  {
    reason: "the element lands later (`<search>` is fixed to a `div` with its role)",
    code: "UF1002",
    pairs: ["<search>", "<selectedcontent>"],
  },
  {
    reason: "form state and focus, which land with `v-model` and refs",
    code: "UF1002",
    pairs: [
      "<div autofocus>",
      "<input checked>",
      "<input value>",
      "<option selected>",
      "<audio muted>",
      "<video muted>",
    ],
  },
  {
    reason: "template syntax in some target, or a value the browser hides",
    code: "UF3005",
    pairs: ["<div is>", "<div nonce>", "<div slot>"],
  },
  {
    reason: "some target's element types do not declare them (UNDECLARED_ATTRIBUTES, ARIA drafts)",
    code: "UF1002",
    pairs: [
      ...[...DRAFT_ARIA_ATTRIBUTES].map((name) => `<div ${name}>`),
      ...[...UNDECLARED_ATTRIBUTES]
        .filter(([tag]) => !UNRENDERABLE_ELEMENTS.has(tag))
        .flatMap(([tag, names]) =>
          [...names.keys()].map((name) => `<${tag === "*" ? "div" : tag} ${name}>`),
        ),
    ],
  },
  {
    reason: 'only a submit button overrides its form: the sweep sets them on `type="submit"`',
    code: "UF3006",
    pairs: SUBMISSION_OVERRIDES.map((name) => `<input ${name}>`),
  },
  { reason: "a nested document", code: "UF3008", pairs: ["<iframe srcdoc>"] },
];

/** What only the bound sweep leaves out, with LEFT_OUT's. */
const LEFT_OUT_BOUND: readonly { reason: string; code: string; pairs: readonly string[] }[] = [
  {
    reason: 'boolean attributes Vue\'s server or Svelte render as "false" (ADR-0037)',
    code: "UF1002",
    pairs: ["<div hidden>", "<div itemscope>", "<video playsinline>"],
  },
  {
    reason: "nested documents and resources Angular refuses to bind (UNBINDABLE_ATTRIBUTES)",
    code: "UF1002",
    pairs: [...UNBINDABLE_ATTRIBUTES].flatMap(([tag, names]) =>
      [...names.keys()].map((name) => `<${tag} ${name}>`),
    ),
  },
  {
    reason: "what decides which option starts selected, which clients set after the options",
    code: "UF1002",
    pairs: ["<select multiple>", "<select size>", "<option disabled>", "<optgroup disabled>"],
  },
];

/** The pairs a list of rules leaves out, with each one's code. */
function expectedLeftOut(rules: typeof LEFT_OUT): Map<string, string> {
  return new Map(rules.flatMap(({ code, pairs }) => pairs.map((pair) => [pair, code] as const)));
}

/** Each pair a sweep left out, with the codes the analyzer gave its last value. */
function actualLeftOut(dropped: ReadonlyMap<string, readonly string[]>): Map<string, string> {
  return new Map(
    [...dropped].map(([key, codes]) => [
      key.replace(/ = .*$/, ""),
      [...new Set(codes)].toSorted().join(","),
    ]),
  );
}

describe("what the sweeps leave out", () => {
  it("is only what a stated rule leaves out, for the reason the rule gives", () => {
    const { static: dropped } = sweepDrops();
    expect(Object.fromEntries(actualLeftOut(dropped))).toEqual(
      Object.fromEntries(expectedLeftOut(LEFT_OUT)),
    );
  });

  it("is, when bound, the same and what binding adds, each value of a pair alike", () => {
    const { bound: dropped } = sweepDrops();
    const rules = [...LEFT_OUT, ...LEFT_OUT_BOUND];
    const found = actualLeftOut(dropped);
    // `<search>` is reported twice: the element, and a `string` its role's types reject.
    expect(found.get("<search>")).toBe("UF1002,UF3018");
    found.set("<search>", "UF1002");
    expect(Object.fromEntries(found)).toEqual(Object.fromEntries(expectedLeftOut(rules)));
    const kept = new Set(boundAttributeSweep().map(({ name }) => name.replace(/ = .*$/, "")));
    expect([...found.keys()].filter((pair) => kept.has(pair))).toEqual([]);
  });
});

describe("the suites", () => {
  it("are what every target's parity tests run, on the server and in the browser", () => {
    const titles = paritySuites().map(({ title }) => title);
    expect(titles.slice(0, 6)).toEqual([
      "the tricky cases",
      "seeded random trees",
      "carriage returns",
      "the attribute sweep",
      "the tricky components",
      "the tricky components, read through a props object",
    ]);
    expect(titles.slice(-3)).toEqual([
      "seeded random components",
      "seeded random components, read through a props object",
      "the bound attribute sweep",
    ]);
    expect(titles.filter((title) => title.startsWith("the root: ")).length).toBeGreaterThan(15);
    expect(clientParitySuites().map(({ title }) => title)).toEqual(
      titles.filter((title) => title !== "carriage returns"),
    );
  });

  it("put a root case alone in its suite, as the component's root", () => {
    for (const suite of paritySuites()) {
      if (suite.root === "self") expect(suite.cases, suite.title).toHaveLength(1);
    }
  });
});
