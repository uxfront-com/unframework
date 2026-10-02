import { describe, expect, it } from "vitest";

import {
  collectFeatures,
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
  IR_VERSION,
  span,
  walk,
} from "../src/index.ts";
import type { RenderNode } from "../src/index.ts";

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
    const module = sample();
    expect(module.irVersion).toBe(IR_VERSION);
    expect(JSON.parse(JSON.stringify(module))).toEqual(module);
  });

  it("names the default export 'default' and a named export by its local name", () => {
    expect(createExport("default", "Hello", at)).toMatchObject({ name: "default", local: "Hello" });
    expect(createExport("named", "Hello", at)).toMatchObject({ name: "Hello", local: "Hello" });
  });
});

describe("walk", () => {
  it("visits nodes depth-first in document order, with their parents", () => {
    const visited: string[] = [];
    walk(sample().components[0]!.render, {
      enter(node, parent) {
        visited.push(`${describeNode(node)}<${parent ? parent.tag : "root"}`);
      },
    });
    expect(visited).toEqual(["p<root", "'Hello'<p", "br<p", "'world'<p"]);
  });

  it("skips the children of a node whose enter returns false", () => {
    const visited: string[] = [];
    walk(sample().components[0]!.render, {
      enter(node) {
        visited.push(describeNode(node));
        return false;
      },
    });
    expect(visited).toEqual(["p"]);
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

describe("collectFeatures", () => {
  it("collects the node and attribute kinds a module uses", () => {
    const features = collectFeatures(sample());
    expect([...features.nodeKinds].sort()).toEqual(["Element", "Text"]);
    expect([...features.attributeKinds]).toEqual(["Static"]);
  });
});

function describeNode(node: RenderNode): string {
  return node.kind === "Element" ? node.tag : `'${node.value}'`;
}
