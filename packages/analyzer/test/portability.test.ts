import { createRequire } from "node:module";

import {
  checkInvariants,
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
  HTML_ELEMENTS,
  isComponentName,
  isExportName,
  UNPORTABLE_ELEMENTS,
  UNRENDERABLE_ELEMENTS,
} from "@unframework/ir";
import type { ElementNode, RenderNode } from "@unframework/ir";
import { isComponentName as isParsedComponentName } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { codes, component, run } from "./helpers.ts";

const at = { start: 0, end: 0 };

function el(
  tag: string,
  attributes: Readonly<Record<string, string | true>> = {},
  ...children: (RenderNode | string)[]
): ElementNode {
  return createElement(
    tag,
    Object.entries(attributes).map(([name, value]) => createStaticAttribute(name, value, at)),
    children.map((child) => (typeof child === "string" ? createText(child, at) : child)),
    at,
  );
}

/** What `checkInvariants` makes of a plugin's module whose one component renders `render`. */
function invariantsOf(render: ElementNode) {
  return checkInvariants(
    createModule(
      "A.uf.tsx",
      [createComponent("A", render, at)],
      [createExport("default", "A", at)],
    ),
  );
}

// The analyser rejects these because the targets render them differently, and checkInvariants
// rejects the IR they would lower to, from the same facts in @unframework/ir, so a plugin
// cannot hand the targets what an author cannot write (r3-analyzer-4, r3-analyzer-6).
describe("what the targets render differently", () => {
  it.each<[string, ElementNode]>([
    ["<div><search>q</search></div>", el("div", {}, el("search", {}, "q"))],
    [
      "<div><select><selectedcontent /></select></div>",
      el("div", {}, el("select", {}, el("selectedcontent"))),
    ],
    ["<input autofocus />", el("input", { autofocus: true })],
    ['<p slot="s">a</p>', el("p", { slot: "s" }, "a")],
    ['<p is="x-y">a</p>', el("p", { is: "x-y" }, "a")],
    ['<input value="v" />', el("input", { value: "v" })],
    ['<input type="email" value="v" />', el("input", { type: "email", value: "v" })],
    ['<input type="checkbox" checked />', el("input", { type: "checkbox", checked: true })],
    [
      "<select><option selected>a</option></select>",
      el("select", {}, el("option", { selected: true }, "a")),
    ],
    ["<video muted></video>", el("video", { muted: true })],
    ["<audio muted></audio>", el("audio", { muted: true })],
    ['<div contenteditable="true">x</div>', el("div", { contenteditable: "true" }, "x")],
    ['<iframe srcdoc="x" title="t"></iframe>', el("iframe", { srcdoc: "x", title: "t" })],
    [
      '<iframe src="data:text/html,x" title="t"></iframe>',
      el("iframe", { src: "data:text/html,x", title: "t" }),
    ],
    ['<object data="data:text/html,x"></object>', el("object", { data: "data:text/html,x" })],
    ['<embed src="data:text/html,x" />', el("embed", { src: "data:text/html,x" })],
    ['<a href="javascript:x">a</a>', el("a", { href: "javascript:x" }, "a")],
    ['<img src="" alt="" />', el("img", { src: "", alt: "" })],
    ['<object data=""></object>', el("object", { data: "" })],
    [
      '<map name="m"><area href="" alt="" /></map>',
      el("map", { name: "m" }, el("area", { href: "", alt: "" })),
    ],
    ['<textarea rows="03"></textarea>', el("textarea", { rows: "03" })],
    ['<textarea rows="0"></textarea>', el("textarea", { rows: "0" })],
    ['<ul><li value="+3">a</li></ul>', el("ul", {}, el("li", { value: "+3" }, "a"))],
    [
      "<div><select> <option>a</option></select></div>",
      el("div", {}, el("select", {}, " ", el("option", {}, "a"))),
    ],
    ["<table> <tbody></tbody></table>", el("table", {}, " ", el("tbody"))],
  ])("are reported in %s, and rejected in a plugin's IR", (jsx, render) => {
    const { diagnostics } = component(jsx);
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).not.toEqual([]);
    expect(invariantsOf(render)).not.toEqual([]);
  });

  // Vue resolves a lower-case tag it does not know as a component.
  it("include exactly the HTML elements Vue does not know", () => {
    const vueRequire = createRequire(createRequire(import.meta.url).resolve("vue/package.json"));
    const { isHTMLTag } = vueRequire("@vue/shared") as { isHTMLTag: (tag: string) => boolean };
    const unknown = [...HTML_ELEMENTS].filter(
      (tag) => !isHTMLTag(tag) && !UNRENDERABLE_ELEMENTS.has(tag),
    );
    expect(unknown.toSorted()).toEqual([...UNPORTABLE_ELEMENTS.keys()].toSorted());
  });
});

// Every target names files and classes by a component's name, and writes its export names.
describe("names", () => {
  it.each(["Card", "C", "Card2", "CARD", "card", "_Card", "Card_x", "Ünicode", "Card$", "2Card"])(
    "%s is a component's name for the parser exactly when it is for the IR",
    (name) => {
      expect(isComponentName(name)).toBe(isParsedComponentName(name));
    },
  );

  it.each(["Card", "café", "$x", "_", "if", "x\u200D", "default", "not-an-id", "a b", "1x", "😀"])(
    "%j is an export the analyser accepts exactly when the IR does",
    (name) => {
      const { diagnostics } = run(
        `function Card() {\n  return <p>x</p>;\n}\nexport { Card as "${name}" };\n`,
      );
      expect(codes(diagnostics).includes("UF1103")).toBe(!isExportName(name));
    },
  );
});
