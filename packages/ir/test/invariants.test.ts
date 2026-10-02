import { describe, expect, it } from "vitest";

import {
  checkInvariants,
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
  span,
} from "../src/index.ts";
import type { ElementNode, UfModule } from "../src/index.ts";

const at = span(0, 1);

/** A module whose one component renders `render`. */
function moduleOf(render: ElementNode): UfModule {
  return createModule(
    "A.uf.tsx",
    [createComponent("A", render, at)],
    [createExport("default", "A", at)],
  );
}

const element = (
  tag: string,
  attributes: [string, string | true][] = [],
  children: ElementNode["children"] = [],
) =>
  createElement(
    tag,
    attributes.map(([name, value]) => createStaticAttribute(name, value, at)),
    children,
    at,
  );

describe("checkInvariants", () => {
  it("accepts what the analyser lowers", () => {
    const render = element(
      "div",
      [
        ["class", "a b"],
        ["hidden", true],
        ["aria-hidden", "true"],
        ["data-x", ""],
        ["title", "a\n\tb\f\u00A0😀"],
      ],
      [
        createText("Hello, world! \u00A0😀", at),
        element("br"),
        element("input", [
          ["type", "checkbox"],
          ["disabled", true],
        ]),
      ],
    );
    expect(checkInvariants(moduleOf(render))).toEqual([]);
  });

  // The look-alikes of what the portability invariants reject.
  it.each([
    element("input", [
      ["type", "SUBMIT"],
      ["value", "Go"],
    ]),
    element("div", [["contenteditable", "true"]]),
    element("a", [["href", ""]], [createText("a", at)]),
    element("img", [
      ["src", "data:image/svg+xml,%3Csvg%3E%3C/svg%3E"],
      ["alt", ""],
    ]),
    element("a", [
      ["href", "data:text/plain,x"],
      ["download", "x.txt"],
    ]),
    element("iframe", [
      ["src", "/embed?data:x"],
      ["title", "t"],
    ]),
    element("iframe", [
      ["src", "blob:https://example.com/0c4f"],
      ["title", "t"],
    ]),
    element("object", [["data", "/a.pdf"]]),
    element("textarea", [["rows", "3"]]),
    element("meter", [["value", "0.5"]], [createText("half", at)]),
    element("select", [], [element("option", [["value", "a"]], [createText(" ", at)])]),
    element("div", [], [createText(" ", at)]),
  ])("accepts %j", (render) => {
    expect(checkInvariants(moduleOf(render))).toEqual([]);
  });

  // What a plugin's IR could bring back (core-4): each breaks one invariant.
  it.each([
    [element("script"), "/components/0/render/tag", "a component can render: <script> holds code"],
    [element("slot"), "/components/0/render/tag", "a component can render: <slot>"],
    [element("svg"), "/components/0/render/tag", "must be an HTML element"],
    [element("blink"), "/components/0/render/tag", "must be an HTML element"],
    [element("toString"), "/components/0/render/tag", "must be an HTML element"],
    [element("a", [["href", " javascript:alert(1)"]]), "/attributes/0/value", "javascript:"],
    [element("form", [["action", "JaVa\tScRiPt:x"]]), "/attributes/0/value", "javascript:"],
    [element("div", [["onclick", "alert(1)"]]), "/attributes/0/name", "must be an attribute of"],
    [element("div", [["constructor", "x"]]), "/attributes/0/name", "must be an attribute of"],
    [element("a", [["key", "x"]]), "/attributes/0/name", "must be an attribute of <a>"],
    [
      element("div", [
        ["id", "a"],
        ["id", "b"],
      ]),
      "/attributes/1/name",
      'must set "id" once',
    ],
    [element("span", [["aria-hidden", true]]), "/attributes/0/value", "must be a string"],
    [element("input", [["disabled", ""]]), "/attributes/0/value", "must be true"],
    [element("p", [["class", ""]]), "/attributes/0/value", "class names separated"],
    [element("p", [["class", " a"]]), "/attributes/0/value", "class names separated"],
    [element("p", [["class", "a  b"]]), "/attributes/0/value", "class names separated"],
    [element("p", [["class", "a\tb"]]), "/attributes/0/value", "class names separated"],
    [element("p", [["class", "a\u00A0b"]]), "/attributes/0/value", "class names separated"],
    [element("p", [["title", "a\rb"]]), "/attributes/0/value", "U+000D (carriage-return)"],
    [element("p", [], [createText("a\r\nb", at)]), "/children/0/value", "U+000D"],
    [element("p", [], [createText("a\u0000b", at)]), "/children/0/value", "U+0000 (nul)"],
    [element("p", [], [createText("a\ud800b", at)]), "/children/0/value", "U+D800 (surrogate)"],
    [element("p", [], [createText("\u0007", at)]), "/children/0/value", "U+0007 (control)"],
    [element("p", [], [createText("￾", at)]), "/children/0/value", "(noncharacter)"],
    [element("br", [], [createText("x", at)]), "/components/0/render/children", "void"],
    // What the targets render differently (r3-analyzer-4), and documents and scripts the
    // compiler cannot analyse (r3-analyzer-6).
    [element("search"), "/components/0/render/tag", "renders as itself: Vue 3.5"],
    [
      element("select", [], [element("selectedcontent")]),
      "/children/0/tag",
      "renders as itself: Vue 3.5",
    ],
    [element("div", [["autofocus", true]]), "/attributes/0/name", "React focuses"],
    [element("div", [["slot", "s"]]), "/attributes/0/name", "`slot` is template syntax"],
    [element("div", [["is", "vue:Card"]]), "/attributes/0/name", "`is` is template syntax"],
    [element("input", [["value", "v"]]), "/attributes/0/name", "`value` is the state"],
    [
      element("input", [
        ["type", "Text"],
        ["value", "v"],
      ]),
      "/attributes/1/name",
      "`value` is the state of the <input>",
    ],
    [
      element("input", [
        ["type", "checkbox"],
        ["checked", true],
      ]),
      "/attributes/1/name",
      "`checked` is the state",
    ],
    [
      element("select", [], [element("option", [["selected", true]], [createText("a", at)])]),
      "/children/0/attributes/0/name",
      "`selected` is the state",
    ],
    [element("video", [["muted", true]]), "/attributes/0/name", "`muted` is the state"],
    [
      element("div", [["contenteditable", "true"]], [createText("x", at)]),
      "/attributes/0/name",
      "with children: React warns",
    ],
    [
      element("iframe", [["srcdoc", "<p>x</p>"]]),
      "/attributes/0/name",
      "`srcdoc` holds an HTML document",
    ],
    [element("iframe", [["srcdoc", ""]]), "/attributes/0/name", "`srcdoc` holds"],
    [
      element("iframe", [["src", "data:text/html,<script>parent.x=1</script>"]]),
      "/attributes/0/value",
      "must not be a `data:` URL: <iframe> loads it",
    ],
    [element("object", [["data", " DATA:text/html,x"]]), "/attributes/0/value", "`data:` URL"],
    [element("embed", [["src", "da\tta:x"]]), "/attributes/0/value", "`data:` URL"],
    [element("img", [["src", ""]]), "/attributes/0/value", "React drops an empty `src`"],
    [element("textarea", [["rows", "03"]]), "/attributes/0/value", "canonical positive-integer"],
    [element("textarea", [["rows", "0"]]), "/attributes/0/value", '"0" is not'],
    [element("ol", [["start", "1e1"]]), "/attributes/0/value", "canonical integer"],
    [element("select", [], [createText(" \n", at)]), "/children/0/value", "only whitespace"],
    [element("table", [], [createText(" ", at)]), "/children/0/value", "inside <table>"],
    [
      element("div", [], [element("p", [["onclick", "x"]])]),
      "/components/0/render/children/0/attributes/0/name",
      "must be an attribute of <p>",
    ],
  ])("reports %j", (render, path, message) => {
    const errors = checkInvariants(moduleOf(render));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.path.endsWith(path)).toBe(true);
    expect(errors[0]!.message).toContain(message);
  });

  it("reports an export of no component, an export made twice and a component declared twice", () => {
    const module = createModule(
      "A.uf.tsx",
      [createComponent("A", element("p"), at), createComponent("A", element("p"), at)],
      [
        createExport("default", "A", at),
        createExport("named", "B", at),
        { ...createExport("default", "A", at), span: span(1, 2) },
      ],
    );
    expect(checkInvariants(module)).toEqual([
      {
        path: "/components/1/name",
        message: `must differ from the other components' names, and "A" does not`,
      },
      {
        path: "/exports/1/local",
        message: 'must name a component of the module, and "B" is not one',
      },
      { path: "/exports/2/name", message: 'must export "default" once' },
    ]);
  });

  // Every target writes a component's name as an identifier and names its file by it, and
  // writes each export's name in an export list (r3-analyzer-4).
  it.each([
    ["card", "must be PascalCase"],
    ["../../x/Pwned", "must be PascalCase"],
    ["Card-1", "must be PascalCase"],
    ["Café", "must be PascalCase"],
    ["Card$", "must be PascalCase"],
    ["", "must be PascalCase"],
  ])("reports the component name %j", (name, message) => {
    const module = createModule(
      "A.uf.tsx",
      [createComponent(name, element("p"), at)],
      [createExport("named", name, at)],
    );
    expect(checkInvariants(module).filter((error) => error.path === "/components/0/name")).toEqual([
      expect.objectContaining({ message: expect.stringContaining(message) }),
    ]);
  });

  it("reports two components whose names differ only in case, which name one file", () => {
    const module = createModule(
      "A.uf.tsx",
      [createComponent("Card", element("p"), at), createComponent("CARD", element("p"), at)],
      [createExport("named", "Card", at), createExport("named", "CARD", at)],
    );
    expect(checkInvariants(module)).toEqual([
      {
        path: "/components/1/name",
        message: 'must differ from "Card" by more than case, as each names a file',
      },
    ]);
  });

  it.each([
    [{ kind: "named", name: "not-an-id" }, "/exports/0/name", 'must be "default" or an identifier'],
    [{ kind: "named", name: "a b" }, "/exports/0/name", 'must be "default" or an identifier'],
    [{ kind: "named", name: "" }, "/exports/0/name", 'must be "default" or an identifier'],
    [{ kind: "default", name: "Card" }, "/exports/0/kind", 'must be "named"'],
    [{ kind: "named", name: "default" }, "/exports/0/kind", 'must be "default"'],
  ] as const)("reports the export %j", (entry, path, message) => {
    const module = createModule(
      "A.uf.tsx",
      [createComponent("Card", element("p"), at)],
      [{ ...createExport("named", "Card", at), ...entry }],
    );
    expect(checkInvariants(module)).toEqual([
      expect.objectContaining({ path, message: expect.stringContaining(message) }),
    ]);
  });

  it.each(["Card", "café", "$card", "_", "if", "default"])("accepts the export name %j", (name) => {
    const module = createModule(
      "A.uf.tsx",
      [createComponent("Card", element("p"), at)],
      [createExport(name === "default" ? "default" : "named", "Card", at)].map((entry) => ({
        ...entry,
        name,
      })),
    );
    expect(checkInvariants(module)).toEqual([]);
  });
});
