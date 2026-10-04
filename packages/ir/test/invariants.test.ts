import { describe, expect, it } from "vitest";

import {
  checkInvariants,
  createBinding,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createExport,
  createExpression,
  createFor,
  createFragment,
  createIf,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  createStaticClass,
  createStaticStyle,
  createStyleAttribute,
  createText,
  createToggleClass,
  createTypeDeclaration,
  createTypeText,
  span,
} from "../src/index.ts";
import type {
  Attribute,
  ElementNode,
  FragmentNode,
  RenderNode,
  StyleDeclaration,
  UfModule,
} from "../src/index.ts";
import { everyKind, expression, ids } from "./fixtures.ts";

const at = span(0, 1);

/** A module whose one component renders `render`, with a `label` prop. */
function moduleOf(render: ElementNode | FragmentNode): UfModule {
  const type = createTypeText("string", span(0, 6));
  return createModule(
    "A.uf.tsx",
    [
      createComponent(
        "A",
        render,
        at,
        [createProp("label", true, type, span(10, 11), ids.label)],
        createPropsParameter("destructured", type, at),
        [],
        [createBinding("label", "prop", span(10, 11))],
      ),
    ],
    [createExport("default", "A", at)],
  );
}

/** `label`, the prop of {@link moduleOf}'s component. */
const label = () => expression("label", 0, [["label", ids.label]]);
/** An expression without references. */
const code = (text: string) => createExpression(text, span(0, text.length));

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
    [
      element("path"),
      "/components/0/render/tag",
      "<path> is not: SVG elements sit inside an <svg>",
    ],
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

const svg = (...children: RenderNode[]) =>
  createElement("svg", [createStaticAttribute("viewBox", "0 0 24 24", at)], children, at);
const node = (tag: string, attributes: Attribute[] = [], children: RenderNode[] = []) =>
  createElement(tag, attributes, children, at);
const bound = (name: string) => createBoundAttribute(name, label(), at);
const style = (...declarations: StyleDeclaration[]) => createStyleAttribute(declarations, at);
const text = (value: string) => createText(value, at);
const interpolation = () => createInterpolation(label(), at);
const branch = (children: RenderNode[], condition = true) =>
  createBranch(condition ? label() : undefined, children, at);

// M1's render nodes and attribute kinds (ADR-0034–ADR-0040): what the analyser lowers, and the
// look-alikes of what the invariants reject.
describe("checkInvariants on M1's IR", () => {
  it("accepts a module that uses every kind", () => {
    expect(checkInvariants(everyKind())).toEqual([]);
  });

  it.each<[string, ElementNode | FragmentNode]>([
    [
      "a bound attribute of each kind",
      node("button", [
        bound("title"),
        bound("aria-label"),
        bound("data-x"),
        bound("tabindex"),
        bound("disabled"),
      ]),
    ],
    ["a bound boolean both Vue and Svelte know", node("details", [bound("open")])],
    [
      "a static class beside a spread's class",
      node("p", [
        createStaticAttribute("class", "a", at),
        createSpreadAttribute(
          label(),
          [createSpreadKey("class", at), createSpreadKey("id", at)],
          at,
        ),
      ]),
    ],
    [
      "a class beside a spread's class",
      node("p", [
        createClassAttribute([createDynamicClass(label(), at)], at),
        createSpreadAttribute(label(), [createSpreadKey("class", at)], at),
      ]),
    ],
    [
      "a class whose static names and toggles differ",
      node("p", [
        createClassAttribute(
          [
            createStaticClass("a b", at),
            createToggleClass("c", label(), at),
            createDynamicClass(label(), at),
          ],
          at,
        ),
      ]),
    ],
    ["an empty class", node("p", [createClassAttribute([], at)])],
    [
      "a style of distinct properties",
      node("p", [
        style(
          createStaticStyle("margin-top", "4px", at),
          createStaticStyle("padding", "0", at),
          createBoundStyle("--Gap", label(), at),
          createStaticStyle("background-image", 'url("data:image/png;base64,AA==")', at),
          createStaticStyle("font-family", '"a;b", serif', at),
        ),
      ]),
    ],
    [
      "a style with a static url() holding a semicolon",
      node("p", [style(createStaticStyle("background", "url(data:image/png;base64,AA==)", at))]),
    ],
    [
      "number-typed attributes in canonical form",
      node("td", [
        createStaticAttribute("colspan", "2", at),
        createStaticAttribute("tabindex", "-1", at),
        createStaticAttribute("aria-level", "2", at),
      ]),
    ],
    [
      "a static iframe src and a bound iframe title",
      node("iframe", [createStaticAttribute("src", "/a", at), bound("title")]),
    ],
    [
      "a root fragment of text, an interpolation and elements",
      createFragment([text("a"), interpolation(), node("p")], at),
    ],
    ["an interpolation in an option", node("select", [], [node("option", [], [interpolation()])])],
    [
      "a conditional of rows in a table body",
      node("tbody", [], [createIf([branch([node("tr")]), branch([node("tr")], false)], at)]),
    ],
    [
      "a conditional of whitespace in a paragraph",
      node("p", [], [createIf([branch([text(" ")])], at)]),
    ],
    [
      "a list of options",
      node("select", [], [createFor(label(), ids.item, code("1"), node("option"), at)]),
    ],
    ["a line feed after the first child of a <pre>", node("pre", [], [node("b"), text("\nx")])],
    [
      "a line feed that is not first in a <pre>'s branch",
      node("pre", [], [createIf([branch([text("x\n")])], at)]),
    ],
    [
      "an empty middle branch",
      node("p", [], [createIf([branch([]), branch([text("a")]), branch([text("b")], false)], at)]),
    ],
    [
      "an icon",
      svg(
        node("title", [], [text("Close"), interpolation()]),
        node("path", [
          createStaticAttribute("d", "M0 0", at),
          createStaticAttribute("stroke-width", "2", at),
          createStaticAttribute("fill", "none", at),
        ]),
        node(
          "linearGradient",
          [
            createStaticAttribute("id", "g", at),
            createStaticAttribute("gradientTransform", "rotate(90)", at),
          ],
          [
            node("stop", [
              createStaticAttribute("offset", "0", at),
              createStaticAttribute("stop-color", "red", at),
            ]),
          ],
        ),
        node("use", [createStaticAttribute("href", "#g", at), bound("x")]),
        node("g", [
          createStaticAttribute("class", "a", at),
          createStaticAttribute("aria-hidden", "true", at),
          createStaticAttribute("data-x", "1", at),
        ]),
      ),
    ],
    [
      "whitespace in SVG text and its spans",
      svg(node("text", [], [text(" "), node("tspan", [], [text(" "), interpolation()])])),
    ],
    ["text in an SVG group", svg(node("g", [], [text("a")]))],
  ])("accepts %s", (_, render) => {
    const module = moduleOf(render);
    if (JSON.stringify(render).includes(ids.item)) {
      module.components[0]!.bindings.push(createBinding("item", "loopVar", span(300, 301)));
    }
    expect(checkInvariants(module)).toEqual([]);
  });

  // What a plugin's IR could bring back: each breaks one invariant, once.
  it.each<[string, ElementNode | FragmentNode, string, string]>([
    // Attributes, set once across every kind.
    [
      "a static style",
      node("p", [createStaticAttribute("style", "color: red", at)]),
      "/attributes/0/name",
      "must not be a static attribute",
    ],
    [
      "a bound class",
      node("p", [bound("class")]),
      "/attributes/0/name",
      "must not be bound: a `class` is a Class",
    ],
    [
      "a bound style",
      node("p", [bound("style")]),
      "/attributes/0/name",
      "must not be bound: a `style`",
    ],
    [
      "a bound boolean Vue's server renders as false",
      node("p", [bound("hidden")]),
      "/attributes/0/name",
      "Vue's server or Svelte",
    ],
    [
      "a bound playsinline",
      node("video", [bound("playsinline")]),
      "/attributes/0/name",
      "Vue's server or Svelte",
    ],
    ["a bound iframe src", node("iframe", [bound("src")]), "/attributes/0/name", "resource URL"],
    ["a bound object data", node("object", [bound("data")]), "/attributes/0/name", "resource URL"],
    ["a bound iframe sandbox", node("iframe", [bound("sandbox")]), "/attributes/0/name", "NG0910"],
    [
      "a bound autofocus",
      node("input", [bound("autofocus")]),
      "/attributes/0/name",
      "React focuses",
    ],
    [
      "a bound value",
      node("input", [bound("value")]),
      "/attributes/0/name",
      "`value` is the state",
    ],
    ["a bound srcdoc", node("iframe", [bound("srcdoc")]), "/attributes/0/name", "`srcdoc` holds"],
    [
      "a bound handler",
      node("p", [bound("onclick")]),
      "/attributes/0/name",
      "must be an attribute of <p>",
    ],
    [
      "a bound contenteditable with children",
      node("p", [bound("contenteditable")], [interpolation()]),
      "/attributes/0/name",
      "with children",
    ],
    [
      "a spread's style",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("style", at)], at)]),
      "/attributes/0/keys/0/name",
      "must not be bound: a `style`",
    ],
    [
      "a spread's handler",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("onclick", at)], at)]),
      "/attributes/0/keys/0/name",
      "must be an attribute of <p>",
    ],
    [
      "a spread's key",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("key", at)], at)]),
      "/attributes/0/keys/0/name",
      "must be an attribute of <p>",
    ],
    [
      "a spread's hidden",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("hidden", at)], at)]),
      "/attributes/0/keys/0/name",
      "Vue's server or Svelte",
    ],
    [
      "a spread's key that is written too",
      node("p", [
        createStaticAttribute("id", "a", at),
        createSpreadAttribute(label(), [createSpreadKey("id", at)], at),
      ]),
      "/attributes/1/keys/0/name",
      'must set "id" once',
    ],
    [
      "two spreads with a class",
      node("p", [
        createSpreadAttribute(label(), [createSpreadKey("class", at)], at),
        createSpreadAttribute(label(), [createSpreadKey("class", at)], at),
      ]),
      "/attributes/1/keys/0/name",
      'must set "class" once',
    ],
    [
      "a static class and a class",
      node("p", [createStaticAttribute("class", "a", at), createClassAttribute([], at)]),
      "/attributes/1",
      'must set "class" once',
    ],
    [
      "a bound and a static title",
      node("p", [bound("title"), createStaticAttribute("title", "a", at)]),
      "/attributes/1/name",
      'must set "title" once',
    ],
    ["two styles", node("p", [style(), style()]), "/attributes/1", 'must set "style" once'],
    // Class parts.
    [
      "static class names that are not canonical",
      node("p", [createClassAttribute([createStaticClass("a  b", at)], at)]),
      "/attributes/0/items/0/value",
      "class names separated",
    ],
    [
      "a toggle of two names",
      node("p", [createClassAttribute([createToggleClass("a b", label(), at)], at)]),
      "/attributes/0/items/0/name",
      "must be one class name",
    ],
    [
      "a class named twice",
      node("p", [
        createClassAttribute(
          [createStaticClass("a b", at), createToggleClass("a", label(), at)],
          at,
        ),
      ]),
      "/attributes/0/items/1",
      'must name the class "a" once',
    ],
    // Style declarations.
    [
      "a property in camel case",
      node("p", [style(createStaticStyle("marginTop", "0", at))]),
      "/declarations/0/property",
      "must be a CSS property",
    ],
    [
      "a vendor-prefixed property",
      node("p", [style(createStaticStyle("-webkit-line-clamp", "2", at))]),
      "/declarations/0/property",
      "without a vendor prefix",
    ],
    [
      "a property set twice",
      node("p", [
        style(createStaticStyle("color", "red", at), createBoundStyle("color", label(), at)),
      ]),
      "/declarations/1/property",
      'must set "color" once',
    ],
    [
      "a shorthand and its longhand",
      node("p", [
        style(createStaticStyle("margin", "0", at), createStaticStyle("margin-top", "1px", at)),
      ]),
      "/declarations/1/property",
      'must not set what "margin" sets',
    ],
    [
      "two shorthands that share a longhand",
      node("p", [
        style(
          createStaticStyle("border-top", "0", at),
          createStaticStyle("border-color", "red", at),
        ),
      ]),
      "/declarations/1/property",
      'must not set what "border-top" sets',
    ],
    [
      "all and a property",
      node("p", [
        style(createStaticStyle("all", "unset", at), createStaticStyle("color", "red", at)),
      ]),
      "/declarations/1/property",
      'must not set what "all" sets',
    ],
    [
      "a value that ends its declaration",
      node("p", [style(createStaticStyle("color", "red; background: blue", at))]),
      "/declarations/0/value",
      "a `;` ends the declaration",
    ],
    [
      "an important value",
      node("p", [style(createStaticStyle("color", "red !important", at))]),
      "/declarations/0/value",
      "`!important`",
    ],
    [
      "an empty value",
      node("p", [style(createStaticStyle("color", "", at))]),
      "/declarations/0/value",
      "must not be empty",
    ],
    [
      "a value with an open string",
      node("p", [style(createStaticStyle("content", '"a', at))]),
      "/declarations/0/value",
      "must close its strings",
    ],
    [
      "a value with a carriage return",
      node("p", [style(createStaticStyle("content", "a\rb", at))]),
      "/declarations/0/value",
      "U+000D",
    ],
    // Number-typed attributes, which React and Qwik write as number literals.
    [
      "a tabindex that is not a canonical number",
      node("p", [createStaticAttribute("tabindex", "01", at)]),
      "/attributes/0/value",
      "must be a number in canonical form",
    ],
    [
      "an image width that is not a number",
      node("img", [
        createStaticAttribute("alt", "", at),
        createStaticAttribute("width", "10px", at),
      ]),
      "/attributes/1/value",
      "must be a number in canonical form",
    ],
    // Text: where it renders alike, never two side by side.
    [
      "two texts side by side",
      node("p", [], [text("a"), text("b")]),
      "/children/1",
      "must not follow another text",
    ],
    [
      "two texts side by side in a branch",
      node("p", [], [createIf([branch([text("a"), text("b")])], at)]),
      "/branches/0/children/1",
      "must not follow another text",
    ],
    [
      "an interpolation in a table",
      node("table", [], [interpolation()]),
      "/children/0",
      "must not be in a <table>",
    ],
    [
      "an interpolation in a select",
      node("select", [], [interpolation()]),
      "/children/0",
      "must not be in a <select>",
    ],
    [
      "an interpolation in a textarea",
      node("textarea", [], [interpolation()]),
      "/children/0",
      "must not be in a <textarea>",
    ],
    [
      "an interpolation in a table's branch",
      node("tbody", [], [createIf([branch([interpolation()])], at)]),
      "/branches/0/children/0",
      "must not be in a <tbody>",
    ],
    [
      "text in a table's branch",
      node("tbody", [], [createIf([branch([node("tr")]), branch([text("none")], false)], at)]),
      "/children/0",
      "must not render text in a <tbody>",
    ],
    [
      "text in a nested branch of a select",
      node("select", [], [createIf([branch([createIf([branch([text("a")])], at)])], at)]),
      "/children/0",
      "must not render text in a <select>",
    ],
    [
      "a conditional in a textarea",
      node("textarea", [], [createIf([branch([node("b")])], at)]),
      "/children/0",
      "must not render text in a <textarea>",
    ],
    [
      "a list in a textarea",
      node("textarea", [], [createFor(label(), ids.item, code("1"), node("b"), at)]),
      "/children/0",
      "must not be in a <textarea>",
    ],
    [
      "whitespace in a select's branch",
      node("select", [], [createIf([branch([text(" ")])], at)]),
      "/branches/0/children/0/value",
      "only whitespace",
    ],
    [
      "a line feed that starts a <pre>",
      node("pre", [], [text("\nx")]),
      "/children/0/value",
      "must not start with a line feed",
    ],
    [
      "a line feed that starts a <textarea>",
      node("textarea", [], [text("\n")]),
      "/children/0/value",
      "must not start with a line feed",
    ],
    [
      "a line feed that starts a <pre>'s branch",
      node("pre", [], [createIf([branch([node("b")]), branch([text("\nx")], false)], at)]),
      "/children/0/branches/1/children/0/value",
      "must not start with a line feed",
    ],
    // Conditionals and fragments.
    [
      "a conditional without branches",
      node("p", [], [createIf([], at)]),
      "/children/0/branches",
      "must have a branch",
    ],
    [
      "an else before the last branch",
      node("p", [], [createIf([branch([text("a")], false), branch([text("b")])], at)]),
      "/children/0/branches/0",
      "only the last branch is an else",
    ],
    [
      "an else alone",
      node("p", [], [createIf([branch([text("a")], false)], at)]),
      "/children/0/branches/0",
      "an else follows another branch",
    ],
    [
      "an empty else",
      node("p", [], [createIf([branch([text("a")]), branch([], false)], at)]),
      "/children/0/branches/1",
      "an empty else renders nothing",
    ],
    [
      "a conditional that renders nothing",
      node("p", [], [createIf([branch([]), branch([])], at)]),
      "/children/0/branches",
      "must render something in a branch",
    ],
    [
      "an empty root fragment",
      createFragment([], at),
      "/components/0/render/children",
      "must hold a root node",
    ],
    // SVG (ADR-0040).
    [
      "an SVG element outside an <svg>",
      node("p", [], [node("circle")]),
      "/children/0/tag",
      "SVG elements sit inside an <svg>",
    ],
    [
      "an HTML element inside an <svg>",
      svg(node("div")),
      "/children/0/tag",
      "must be an SVG element, and <div> is not",
    ],
    [
      "a link inside an <svg>",
      svg(node("a")),
      "/children/0/tag",
      "must be an SVG element, and <a> is not",
    ],
    [
      "an SVG element in the wrong case",
      svg(node("lineargradient")),
      "/children/0/tag",
      "must be an SVG element",
    ],
    [
      "an SVG element the parser does not restore",
      svg(node("feDropShadow")),
      "/children/0/tag",
      "must be an SVG element",
    ],
    ["SVG animation", svg(node("animate")), "/children/0/tag", "SMIL animation"],
    ["an SVG <style>", svg(node("style")), "/children/0/tag", "a component can render: <style>"],
    [
      "an element in an SVG <title>",
      svg(node("title", [], [node("tspan")])),
      "/children/0/children/0/tag",
      "must not be inside an SVG <title>",
    ],
    [
      "an SVG attribute in the wrong case",
      svg(node("rect", [createStaticAttribute("viewbox", "0 0 1 1", at)])),
      "/children/0/attributes/0/name",
      "must be an attribute of <rect>",
    ],
    [
      "an attribute of another SVG element",
      svg(node("circle", [createStaticAttribute("d", "M0 0", at)])),
      "/children/0/attributes/0/name",
      "must be an attribute of <circle>",
    ],
    [
      "an xlink:href",
      svg(node("use", [createStaticAttribute("xlink:href", "#a", at)])),
      "/children/0/attributes/0/name",
      "must be an attribute of <use>",
    ],
    [
      "an HTML attribute on an SVG element",
      svg(node("circle", [createStaticAttribute("title", "a", at)])),
      "/children/0/attributes/0/name",
      "must be an attribute of <circle>",
    ],
    [
      "a true SVG attribute",
      svg(node("circle", [createStaticAttribute("fill", true, at)])),
      "/children/0/attributes/0/value",
      "SVG has no boolean attributes",
    ],
    [
      "a javascript: URL on an SVG element",
      svg(node("use", [createStaticAttribute("href", "javascript:alert(1)", at)])),
      "/children/0/attributes/0/value",
      "javascript:",
    ],
    [
      "whitespace in an SVG group",
      svg(node("g", [], [text(" ")])),
      "/children/0/children/0/value",
      "drops it in SVG outside a <text>",
    ],
    [
      "whitespace in an SVG title",
      svg(node("title", [], [text(" ")])),
      "/children/0/children/0/value",
      "drops it in SVG outside a <text>",
    ],
    [
      "an interpolation in an SVG group",
      svg(node("g", [], [interpolation()])),
      "/children/0/children/0",
      "must not be in an SVG <g>",
    ],
    [
      "text in an SVG group's branch",
      svg(node("g", [], [createIf([branch([text("a")])], at)])),
      "/children/0/children/0",
      "must not render text in an SVG <g>",
    ],
    [
      "a bound boolean on an SVG element",
      svg(node("circle", [bound("hidden")])),
      "/children/0/attributes/0/name",
      "must be an attribute of <circle>",
    ],
  ])("reports %s", (_, render, path, message) => {
    const module = moduleOf(render);
    if (JSON.stringify(render).includes(ids.item)) {
      module.components[0]!.bindings.push(createBinding("item", "loopVar", span(300, 301)));
    }
    const errors = checkInvariants(module);
    expect(errors, JSON.stringify(errors)).toHaveLength(1);
    expect(errors[0]!.path.endsWith(path), errors[0]!.path).toBe(true);
    expect(errors[0]!.message).toContain(message);
  });
});

/** A module with `everyKind`'s component changed by `change`. */
function changed(change: (module: UfModule) => void): UfModule {
  const module = everyKind();
  change(module);
  return module;
}

const component = (module: UfModule) => module.components[0]!;
const root = (module: UfModule) => component(module).render as FragmentNode;
const card = (module: UfModule) => root(module).children[0] as ElementNode;
const list = (module: UfModule) => root(module).children[1] as Extract<RenderNode, { kind: "If" }>;
const loop = (module: UfModule) =>
  (list(module).branches[0]!.children[0] as ElementNode).children[0] as Extract<
    RenderNode,
    { kind: "For" }
  >;

/** A module whose component takes the props named, each with its own binding, and renders `<p>`. */
function withProps(names: string[], form: "destructured" | "object" = "destructured"): UfModule {
  const type = createTypeText("P", span(0, 1));
  const props = names.map((name, index) =>
    createProp(
      name,
      true,
      type,
      span(10 * (index + 1), 10 * (index + 1) + 1),
      `${name}@${10 * (index + 1)}`,
    ),
  );
  const bindings = names.map((name, index) =>
    createBinding(name, "prop", span(10 * (index + 1), 10 * (index + 1) + 1)),
  );
  return createModule(
    "A.uf.tsx",
    [
      createComponent(
        "A",
        createElement("p", [], [], at),
        at,
        props,
        createPropsParameter(form, type, at, form === "object" ? "props" : undefined),
        [],
        bindings,
      ),
    ],
    [createExport("default", "A", at)],
  );
}

describe("checkInvariants on props, bindings, expressions and types", () => {
  it.each<[string, () => UfModule]>([
    ["the object form", () => withProps(["label", "tone"], "object")],
    [
      "props with reserved-looking names",
      () => withProps(["keys", "onward", "ngram", "classes", "Props", "x1"]),
    ],
    [
      "a prop read through the object form",
      () =>
        changed((module) => {
          const { propsParameter } = component(module);
          Object.assign(propsParameter!, { form: "object", name: "props" });
          delete component(module).props[1]!.default;
          card(module).children[1] = createInterpolation(
            expression("props.label", 290, [["props.label", ids.label]]),
            at,
          );
        }),
    ],
    [
      "a shorthand reference",
      () =>
        changed((module) => {
          card(module).attributes[2] = createBoundAttribute(
            "title",
            createExpression("String({ label })", span(250, 267), [
              { kind: "Global", name: "String", span: span(250, 256) },
              { kind: "Binding", binding: ids.label, span: span(259, 264), shorthand: true },
            ]),
            at,
          );
        }),
    ],
  ])("accepts %s", (_, build) => {
    expect(checkInvariants(build())).toEqual([]);
  });

  it.each<[string, () => UfModule, string, string]>([
    // Expressions (ADR-0035).
    [
      "code that is not its span's length",
      () =>
        changed(
          (module) =>
            void ((card(module).attributes[2] as { value: { code: string } }).value.code =
              "label.trim"),
        ),
      "/attributes/2/value/code",
      "must be the source at its span, 12 characters",
    ],
    [
      "references out of order",
      () =>
        changed((module) => {
          const { value } = card(module).children[1] as { value: { refs: unknown[] } };
          value.refs = value.refs.toReversed();
        }),
      "/children/0/children/1/value/refs/1/span",
      "must lie in the expression",
    ],
    [
      "a reference outside its expression",
      () =>
        changed(
          (module) =>
            void ((
              card(module).attributes[2] as { value: { refs: { span: unknown }[] } }
            ).value.refs[0]!.span = span(240, 245)),
        ),
      "/attributes/2/value/refs/0/span",
      "must lie in the expression",
    ],
    [
      "a reference to no binding",
      () =>
        changed(
          (module) =>
            void ((
              card(module).attributes[2] as { value: { refs: { binding: string }[] } }
            ).value.refs[0]!.binding = "nope@1"),
        ),
      "/attributes/2/value/refs/0/binding",
      "must name a binding of the component",
    ],
    [
      "a loop variable outside its list",
      () =>
        changed(
          (module) =>
            void (card(module).children[1] = createInterpolation(
              expression("item", 290, [["item", ids.item]]),
              at,
            )),
        ),
      "/children/0/children/1/value/refs/0/binding",
      "must name a binding in scope here",
    ],
    [
      "a global no expression may read",
      () =>
        changed(
          (module) =>
            void (card(module).children[1] = createInterpolation(
              expression("Date", 290, [["Date"]]),
              at,
            )),
        ),
      "/children/0/children/1/value/refs/0/name",
      "must be a global expressions may read",
    ],
    [
      "a reference that spans another name",
      () =>
        changed(
          (module) =>
            void (card(module).attributes[2] = createBoundAttribute(
              "title",
              expression("label.trim()", 250, [["trim", ids.label]]),
              at,
            )),
        ),
      "/attributes/2/value/refs/0/span",
      'must span "label"',
    ],
    [
      "a global reference that spans another name",
      () =>
        changed(
          (module) =>
            void (card(module).children[1] = createInterpolation(
              createExpression("String(label)", span(290, 303), [
                { kind: "Global", name: "Number", span: span(290, 296) },
                { kind: "Binding", binding: ids.label, span: span(297, 302) },
              ]),
              at,
            )),
        ),
      "/value/refs/0/span",
      'must span "Number"',
    ],
    // Props (ADR-0034).
    [
      "a reserved prop name",
      () => withProps(["key"]),
      "/props/0/name",
      "`key` is the frameworks' list identity",
    ],
    [
      "a prop named after a global",
      () => withProps(["Math"]),
      "/props/0/name",
      "the Angular target declares as a member",
    ],
    [
      "a prop named after an Angular keyword",
      () => withProps(["as"]),
      "/props/0/name",
      "a keyword in Angular's template expressions",
    ],
    [
      "a prop named after a reserved word",
      () => withProps(["package"]),
      "/props/0/name",
      "a reserved word",
    ],
    [
      "an event's name as a prop",
      () => withProps(["onClick"]),
      "/props/0/name",
      "events land in M2",
    ],
    [
      "a prop name Angular reserves",
      () => withProps(["ngModel"]),
      "/props/0/name",
      "Angular reserves",
    ],
    [
      "a prop name that is not ASCII",
      () => withProps(["étiquette"]),
      "/props/0/name",
      "ASCII letters and digits",
    ],
    [
      "a prop name ending in $",
      () => withProps(["on$"]),
      "/props/0/name",
      "ASCII letters and digits",
    ],
    [
      "a prop declared twice",
      () => withProps(["a", "a"]),
      "/props/1/name",
      'must declare "a" once',
    ],
    [
      "a default on a required prop",
      () => changed((module) => void (component(module).props[1]!.optional = false)),
      "/props/1/default",
      "must be absent on a required prop",
    ],
    [
      "a default in the object form",
      () =>
        changed(
          (module) =>
            void Object.assign(component(module).propsParameter!, {
              form: "object",
              name: "props",
            }),
        ),
      "/props/1/default",
      "must be absent in the object form",
    ],
    [
      "a default that references a prop",
      () =>
        changed(
          (module) =>
            void (component(module).props[1]!.default = expression("label", 21, [
              ["label", ids.label],
            ])),
        ),
      "/props/1/default/refs",
      "must be empty",
    ],
    [
      "a prop whose binding has another name",
      () => {
        const module = withProps(["a"]);
        module.components[0]!.bindings[0] = createBinding("b", "prop", span(10, 11));
        module.components[0]!.props[0]!.binding = "b@10";
        return module;
      },
      "/props/0/binding",
      'must name a prop binding named "a"',
    ],
    [
      "a prop binding of no prop",
      () => changed((module) => void delete component(module).props[0]!.binding),
      "/bindings/0",
      'must be the binding of one prop, and "label@10" is of 0',
    ],
    [
      "a prop without a binding in the object form",
      () =>
        changed((module) => {
          Object.assign(component(module).propsParameter!, { form: "object", name: "props" });
          delete component(module).props[1]!.default;
          delete component(module).props[3]!.binding;
          component(module).bindings.splice(3, 1);
          card(module).attributes.splice(3, 1);
        }),
      "/props/3",
      "must have a binding in the object form",
    ],
    [
      "an object form without a name",
      () => {
        const m = withProps(["a"], "object");
        delete m.components[0]!.propsParameter!.name;
        return m;
      },
      "/propsParameter/name",
      "must name the props parameter",
    ],
    [
      "a destructured form with a name",
      () => {
        const m = withProps(["a"]);
        m.components[0]!.propsParameter!.name = "props";
        return m;
      },
      "/propsParameter/name",
      "must be absent in the destructured form",
    ],
    [
      "props without a props parameter",
      () => {
        const m = withProps(["a"]);
        delete m.components[0]!.propsParameter;
        return m;
      },
      "/components/0/props",
      "must be empty for a component without a props parameter",
    ],
    [
      "a type text that is not its span's length",
      () => changed((module) => void (component(module).props[0]!.type.code = "str")),
      "/props/0/type/code",
      "must be the source at its span",
    ],
    // Bindings.
    [
      "a binding id that is not its name and offset",
      () => {
        const m = withProps(["a"]);
        Object.assign(m.components[0]!.bindings[0]!, { id: "a@11" });
        m.components[0]!.props[0]!.binding = "a@11";
        return m;
      },
      "/bindings/0/id",
      'must be "a@10"',
    ],
    [
      "a binding declared twice",
      () => {
        const m = withProps(["a"]);
        m.components[0]!.bindings.push({ ...m.components[0]!.bindings[0]! });
        return m;
      },
      "/bindings/1/id",
      'must declare "a@10" once',
    ],
    [
      "bindings out of order",
      () =>
        changed((module) => {
          const [first, second] = component(module).bindings;
          component(module).bindings.splice(0, 2, second!, first!);
        }),
      "/bindings/1/span",
      "must follow the binding before it",
    ],
    [
      "a loop variable of no list",
      () =>
        changed(
          (module) =>
            void component(module).bindings.push(createBinding("other", "loopVar", span(450, 451))),
        ),
      "/bindings/6",
      "must be the item or index of a list",
    ],
    [
      "a list whose item is a prop",
      () =>
        changed((module) => {
          Object.assign(loop(module), { item: ids.items });
          loop(module).body.children = [
            createInterpolation(expression("items", 360, [["items", ids.items]]), at),
          ];
          component(module).bindings.splice(4, 1);
        }),
      "/children/0/children/0/item",
      'must name a loop variable of the component, and "items@30" is not one',
    ],
    [
      "a list whose index is its item",
      () =>
        changed((module) => {
          Object.assign(loop(module), {
            index: ids.item,
            key: expression("item", 350, [["item", ids.item]]),
          });
          component(module).bindings.splice(5, 1);
        }),
      "/index",
      "must differ from the item",
    ],
    [
      "a loop variable two lists declare",
      () =>
        changed((module) => {
          const ul = list(module).branches[0]!.children[0] as ElementNode;
          const copy = structuredClone(loop(module));
          delete copy.index;
          copy.key = expression("item", 350, [["item", ids.item]]);
          ul.children.push(copy);
        }),
      "/bindings/4",
      'must be the item or index of one list, and "item@300" is of 2',
    ],
    // Types.
    [
      "a component type the module does not declare",
      () => changed((module) => void component(module).types.push("Other")),
      "/components/0/types/1",
      "must name a type the module declares",
    ],
    [
      "a component type named twice",
      () => changed((module) => void component(module).types.push("Attrs")),
      "/components/0/types/1",
      'must name "Attrs" once',
    ],
    [
      "a type declared twice",
      () =>
        changed(
          (module) =>
            void module.types.push(
              createTypeDeclaration("Attrs", false, "type Attrs = {}", span(40, 55)),
            ),
        ),
      "/types/1/name",
      'must declare "Attrs" once',
    ],
    [
      "a type declaration out of order",
      () =>
        changed(
          (module) =>
            void module.types.unshift(
              createTypeDeclaration("B", false, "type B = {}", span(40, 51)),
            ),
        ),
      "/types/1/span",
      "must follow the declaration before it",
    ],
    [
      "a type declaration whose code is not its span's length",
      () => changed((module) => void (module.types[0]!.code = "interface Attrs {}")),
      "/types/0/code",
      "must be the source at its span",
    ],
    [
      "a type name that is not an identifier",
      () =>
        changed(
          (module) =>
            void module.types.push(createTypeDeclaration("A-B", false, "x", span(40, 41))),
        ),
      "/types/1/name",
      "must be an identifier",
    ],
  ])("reports %s", (_, build, path, message) => {
    const errors = checkInvariants(build());
    expect(errors, JSON.stringify(errors)).toHaveLength(1);
    expect(errors[0]!.path.endsWith(path), errors[0]!.path).toBe(true);
    expect(errors[0]!.message).toContain(message);
  });
});
