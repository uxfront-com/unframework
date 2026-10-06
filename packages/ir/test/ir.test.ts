import { describe, expect, it } from "vitest";

import {
  checkInvariants,
  childrenOf,
  collectFeatures,
  createBindingReference,
  createBranch,
  createComponent,
  createElement,
  createExport,
  createFor,
  createModule,
  createProp,
  createPropsParameter,
  createStaticAttribute,
  createText,
  createTypeText,
  expressionsOf,
  IR_VERSION,
  spansOf,
  span,
  walk,
} from "../src/index.ts";
import type { VisitedNode } from "../src/index.ts";
import { everyKind, expression, ids } from "./fixtures.ts";

const at = span(0, 1);

function sample() {
  const render = createElement(
    "p",
    [createStaticAttribute("class", "greeting", at), createStaticAttribute("hidden", true, at)],
    [createText("Hello", at), createElement("br", [], [], at), createText("world", at)],
    at,
  );
  return createModule(
    "Hello.uf.tsx",
    [createComponent("Hello", render, at)],
    [createExport("default", "Hello", at)],
  );
}

describe("builders", () => {
  it("builds plain, JSON-round-trippable data", () => {
    for (const module of [sample(), everyKind()]) {
      expect(module.irVersion).toBe(IR_VERSION);
      expect(JSON.parse(JSON.stringify(module))).toEqual(module);
    }
  });

  it("builds a module whose IR keeps the invariants", () => {
    expect(checkInvariants(sample())).toEqual([]);
    expect(checkInvariants(everyKind())).toEqual([]);
  });

  it("names the default export 'default' and a named export by its local name", () => {
    expect(createExport("default", "Hello", at)).toMatchObject({ name: "default", local: "Hello" });
    expect(createExport("named", "Hello", at)).toMatchObject({ name: "Hello", local: "Hello" });
  });

  // Snapshots keep the key order of the types, and a JSON round trip drops an `undefined` key
  // that validateModule and a structured clone would keep (r-ir-analyzer).
  it("writes keys in the order of the types and leaves absent optional fields out", () => {
    const type = createTypeText("string", at);
    expect(Object.keys(createProp("label", false, type, at))).toEqual([
      "name",
      "optional",
      "type",
      "span",
    ]);
    expect(Object.keys(createProp("tone", true, type, at, ids.tone, expression('"a"', 0)))).toEqual(
      ["name", "optional", "type", "default", "binding", "span"],
    );
    expect(Object.keys(createPropsParameter("destructured", type, at))).toEqual([
      "form",
      "type",
      "span",
    ]);
    expect(Object.keys(createPropsParameter("object", type, at, "props"))).toEqual([
      "form",
      "name",
      "type",
      "span",
    ]);
    expect(Object.keys(createBranch(undefined, [], at))).toEqual(["children", "span"]);
    expect(Object.keys(createBranch(expression("a", 0), [], at))).toEqual([
      "condition",
      "children",
      "span",
    ]);
    const body = createElement("li", [], [], at);
    expect(
      Object.keys(createFor(expression("a", 0), ids.item, expression("a", 0), body, at)),
    ).toEqual(["kind", "source", "item", "key", "body", "span"]);
    expect(
      Object.keys(createFor(expression("a", 0), ids.item, expression("a", 0), body, at, ids.index)),
    ).toEqual(["kind", "source", "item", "index", "key", "body", "span"]);
    expect(Object.keys(createBindingReference(ids.label, at))).toEqual(["kind", "binding", "span"]);
    expect(createBindingReference(ids.label, at, true)).toEqual({
      kind: "Binding",
      binding: ids.label,
      span: at,
      shorthand: true,
    });
    const component = createComponent("A", body, at);
    expect(Object.keys(component)).toEqual([
      "name",
      "span",
      "props",
      "types",
      "bindings",
      "render",
    ]);
    expect(Object.keys(everyKind().components[0]!)).toEqual([
      "name",
      "span",
      "props",
      "propsParameter",
      "types",
      "bindings",
      "render",
    ]);
    expect(Object.keys(everyKind())).toEqual([
      "irVersion",
      "file",
      "components",
      "exports",
      "types",
    ]);
  });
});

/** A node, briefly: its tag, its text in quotes, or its kind. */
function describeNode(node: VisitedNode): string {
  if (node.kind === "Element") return node.tag;
  if (node.kind === "Text") return `'${node.value}'`;
  return node.kind;
}

describe("walk", () => {
  it("visits nodes depth-first in document order, with their parents", () => {
    const visited: string[] = [];
    walk(sample().components[0]!.render, {
      enter(node, parent) {
        visited.push(`${describeNode(node)}<${parent ? describeNode(parent) : "root"}`);
      },
    });
    expect(visited).toEqual(["p<root", "'Hello'<p", "br<p", "'world'<p"]);
  });

  it("descends into the root fragment, every branch, list bodies and SVG", () => {
    const visited: string[] = [];
    walk(everyKind().components[0]!.render, {
      enter(node, parent) {
        visited.push(`${describeNode(node)}<${parent ? describeNode(parent) : "root"}`);
      },
    });
    expect(visited).toEqual([
      "Fragment<root",
      "p<Fragment",
      "'Hello, '<p",
      "Interpolation<p",
      "If<Fragment",
      "ul<If",
      "For<ul",
      "li<For",
      "Interpolation<li",
      "p<If",
      "'None'<p",
      "svg<Fragment",
      "circle<svg",
      "text<svg",
      "' '<text",
    ]);
  });

  it("skips the children of a node whose enter returns false", () => {
    const visited: string[] = [];
    walk(everyKind().components[0]!.render, {
      enter(node) {
        visited.push(describeNode(node));
        return node.kind === "Fragment" ? undefined : false;
      },
    });
    expect(visited).toEqual(["Fragment", "p", "If", "svg"]);
  });

  it("calls leave after the children", () => {
    const events: string[] = [];
    walk(sample().components[0]!.render, {
      enter: (node) => void events.push(`enter ${describeNode(node)}`),
      leave: (node) => void events.push(`leave ${describeNode(node)}`),
    });
    expect(events.at(0)).toBe("enter p");
    expect(events.at(-1)).toBe("leave p");
  });
});

describe("childrenOf", () => {
  it("gives every branch's children in order, a list's body, and nothing for text", () => {
    const render = everyKind().components[0]!.render;
    const [card, list] = childrenOf(render);
    expect(childrenOf(list!).map(describeNode)).toEqual(["ul", "p"]);
    const loop = childrenOf(childrenOf(list!)[0]!)[0]!;
    expect(childrenOf(loop).map(describeNode)).toEqual(["li"]);
    expect(childrenOf(childrenOf(card!)[0]!)).toEqual([]);
    expect(childrenOf(childrenOf(card!)[1]!)).toEqual([]);
  });
});

describe("collectFeatures", () => {
  it("collects the node and attribute kinds a module uses", () => {
    const features = collectFeatures(sample());
    expect([...features.nodeKinds].toSorted()).toEqual(["Element", "Text"]);
    expect([...features.attributeKinds]).toEqual(["Static"]);
    expect([...features.bindingKinds]).toEqual([]);
  });

  // A root fragment is no render node: the `fragment` capability covers it.
  it("collects every kind, binding kinds included, and no fragment", () => {
    const features = collectFeatures(everyKind());
    expect([...features.nodeKinds].toSorted()).toEqual([
      "Element",
      "For",
      "If",
      "Interpolation",
      "Text",
    ]);
    expect([...features.attributeKinds].toSorted()).toEqual([
      "Bound",
      "Class",
      "Spread",
      "Static",
      "Style",
    ]);
    expect([...features.bindingKinds].toSorted()).toEqual(["loopVar", "prop"]);
  });
});

describe("expressionsOf", () => {
  it("finds every expression of a component, in document order, with its JSON pointer", () => {
    const component = everyKind().components[0]!;
    expect(
      expressionsOf(component, "/components/0").map((found) => [found.path, found.expression.code]),
    ).toEqual([
      ["/components/0/props/1/default", '"info"'],
      ["/components/0/render/children/0/attributes/0/items/1/condition", 'tone === "warn"'],
      ["/components/0/render/children/0/attributes/0/items/2/value", "tone"],
      ["/components/0/render/children/0/attributes/1/declarations/1/value", "label"],
      ["/components/0/render/children/0/attributes/2/value", "label.trim()"],
      ["/components/0/render/children/0/attributes/3/value", "attrs"],
      ["/components/0/render/children/0/children/1/value", "String(label)"],
      ["/components/0/render/children/1/branches/0/condition", "items.length > 0"],
      ["/components/0/render/children/1/branches/0/children/0/children/0/source", "items"],
      ["/components/0/render/children/1/branches/0/children/0/children/0/key", "index"],
      [
        "/components/0/render/children/1/branches/0/children/0/children/0/body/children/0/value",
        "item",
      ],
    ]);
  });

  it("points into the module from the component by default", () => {
    const [first] = expressionsOf(everyKind().components[0]!);
    expect(first!.path).toBe("/props/1/default");
  });
});

/** The value at a JSON pointer. */
function valueAt(value: unknown, pointer: string): unknown {
  return pointer
    .split("/")
    .slice(1)
    .reduce<unknown>((parent, key) => (parent as Record<string, unknown>)[key], value);
}

describe("spansOf", () => {
  it("finds every span in the module, each at its pointer", () => {
    const module = everyKind();
    const located = spansOf(module);
    for (const entry of located) expect(valueAt(module, entry.path), entry.path).toBe(entry.span);
    // Every object with a span, found by a blind walk of the JSON, is among them.
    const blind: string[] = [];
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}/${index}`));
      else if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
          if (key === "span") blind.push(`${path}/span`);
          else visit(item, `${path}/${key}`);
        }
      }
    };
    visit(module, "");
    expect(located.map(({ path }) => path).toSorted()).toEqual(blind.toSorted());
  });
});
