// The render-parity kit is what every target's parity test trusts, so its parser and its model
// of the IR's DOM are tested here: a lenient parser would pass outputs that differ.
import {
  isBooleanAttribute,
  PERMITTED_CHILDREN,
  REPAIRED_DESCENDANTS,
  REQUIRED_PARENTS,
  TEXTLESS_ELEMENTS,
} from "@unframework/ir";
import type { ElementNode } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { defineTarget, htmlDialect, printMarkup, vueDialect } from "../src/index.ts";
import type { CapabilityCell, CapabilityName, Target } from "../src/index.ts";
import {
  attributeSweep,
  clientParitySuites,
  emitParity,
  paritySuites,
  unsupportedCapabilities,
} from "./render-parity-node.ts";
import {
  CARRIAGE_RETURN_CASES,
  compareCases,
  domOf,
  el,
  FUZZ_CASES,
  fuzzCase,
  parseHtml,
  TRICKY_CASES,
} from "./render-parity.ts";

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
  ])("refuses %j rather than guessing", (html, message) => {
    expect(() => parseHtml(html)).toThrow(message);
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
});

describe("compareCases", () => {
  const cases = [{ name: "one", render: el("p", {}, "a") }];

  it("pairs each case with the root's child at its index", () => {
    const [root, first] = compareCases(parseHtml("<div><p>a</p></div>"), cases);
    expect(root).toEqual({
      name: "the root's children, one element per case",
      expected: ["<p>"],
      actual: ["<p>"],
    });
    expect(first).toEqual({
      name: "one",
      expected: domOf(cases[0]!.render),
      actual: first!.actual,
    });
    expect(first!.actual).toEqual(first!.expected);
  });

  it("names whitespace a compiler left between the cases", () => {
    const [root] = compareCases(parseHtml("<div> <p>a</p></div>"), cases);
    expect(root!.actual).toEqual(['" "', "<p>"]);
  });

  it("refuses output that is not the parity root", () => {
    expect(() => compareCases(parseHtml("<p>a</p>"), cases)).toThrow("expected one root <div>");
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
        if (node.attributes.some((attribute) => isBooleanAttribute(attribute.name))) {
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
    const visit = (node: ElementNode): void => {
      if (node.tag === "select") {
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
    const [file] = await emitParity(reporting, [paragraph], { format: false });
    expect(file!.contents).toBe("<div><p>x</p></div>");
  });

  // What a target cannot render exactly, its capability matrix declares instead.
  it("fails on anything the target reports", async () => {
    await expect(emitParity(reporting, [paragraph, select], { format: false })).rejects.toThrow(
      "test reported UF4001 (no) for the cases.",
    );
  });
});

describe("unsupportedCapabilities", () => {
  const cases = [...TRICKY_CASES, ...FUZZ_CASES, ...attributeSweep()];

  it("names what a case uses that the target's matrix marks unsupported", () => {
    const target = testTarget(printed, "listbox");
    expect(
      cases
        .filter((parityCase) => unsupportedCapabilities(target, parityCase).length)
        .map(({ name }) => name),
    ).toEqual([
      "a single-selection list box",
      "a single-selection list box of option groups",
      "<select size>",
    ]);
    expect(unsupportedCapabilities(target, TRICKY_CASES[0]!)).toEqual([]);
    expect(unsupportedCapabilities(testTarget(printed, "text"), TRICKY_CASES[0]!)).toEqual([
      "text",
    ]);
  });

  it("names nothing on a target that supports every capability", () => {
    const target = testTarget(printed);
    expect(cases.flatMap((parityCase) => unsupportedCapabilities(target, parityCase))).toEqual([]);
  });
});

describe("the attribute sweep", () => {
  const sweep = attributeSweep();

  it("renders every pair the analyzer accepts once, each in its own <div>", () => {
    expect(sweep.length).toBeGreaterThan(200);
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

  it("is a suite of every target's parity tests, on the server and in the browser", () => {
    expect(paritySuites().at(-1)).toEqual(["the attribute sweep", sweep]);
    expect(clientParitySuites().map(([title]) => title)).toEqual([
      "the tricky cases",
      "seeded random trees",
      "the attribute sweep",
    ]);
  });
});
