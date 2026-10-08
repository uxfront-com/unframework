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
  createApiReference,
  createBindingReference,
  createCode,
  createConstItem,
  createEmitReference,
  createEventControl,
  createEventDeclaration,
  createEventReference,
  createFunctionCode,
  createGlobalReference,
  createIdItem,
  createNarrowedPath,
  createParameter,
  createParameterPattern,
  createRefAttribute,
  createRefSource,
  createWriteReference,
} from "../src/index.ts";
import type {
  Attribute,
  Code,
  CodeReference,
  ElementNode,
  EventAttribute,
  Expression,
  FragmentNode,
  FunctionCode,
  InterpolationNode,
  RenderNode,
  SetupItem,
  Span,
  StyleDeclaration,
  UfComponent,
  UfModule,
} from "../src/index.ts";
import { counterIds, everyKind, expression, find, ids, piece } from "./fixtures.ts";

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

  // What a plugin's IR could bring back (ADR-0032): each breaks one invariant.
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
    // Angular merges a static class with a bound one through the class list, which drops it.
    [element("p", [["class", "a b a"]]), "/attributes/0/value", 'must name the class "a" once'],
    [element("p", [["title", "a\rb"]]), "/attributes/0/value", "U+000D (carriage-return)"],
    [element("p", [], [createText("a\r\nb", at)]), "/children/0/value", "U+000D"],
    [element("p", [], [createText("a\u0000b", at)]), "/children/0/value", "U+0000 (nul)"],
    [element("p", [], [createText("a\ud800b", at)]), "/children/0/value", "U+D800 (surrogate)"],
    [element("p", [], [createText("\u0007", at)]), "/children/0/value", "U+0007 (control)"],
    [element("p", [], [createText("￾", at)]), "/children/0/value", "(noncharacter)"],
    [element("br", [], [createText("x", at)]), "/components/0/render/children", "void"],
    // What the targets render differently, and documents and scripts the compiler cannot
    // analyse.
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
  // writes each export's name in an export list.
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
/** The item of a list over `label`, which keys it. */
const item = () => expression("item", 0, [["item", ids.item]]);
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
          false,
          at,
        ),
      ]),
    ],
    [
      "a class beside a spread's class",
      node("p", [
        createClassAttribute([createDynamicClass(label(), at)], at),
        createSpreadAttribute(label(), [createSpreadKey("class", at)], false, at),
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
    ["a static class of distinct names", node("p", [createStaticAttribute("class", "a b c", at)])],
    [
      "a style of distinct properties",
      node("p", [
        style(
          createStaticStyle("margin-top", "4px", at),
          createStaticStyle("padding", "0", at),
          createBoundStyle("--gap", label(), at),
          createStaticStyle("background-image", 'url("data:image/png;base64,AA==")', at),
          createStaticStyle("font-family", '"a;b", serif', at),
        ),
      ]),
    ],
    [
      "values Angular's style parser reads as written",
      node("p", [
        style(
          createStaticStyle("content", '"a(b)"', at),
          createStaticStyle("font-family", "'A\"B', serif", at),
          createStaticStyle("--gap", "1px", at),
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
      node("select", [], [createFor(label(), ids.item, item(), node("option"), at)]),
    ],
    ["a line feed after the first child of a <pre>", node("pre", [], [node("b"), text("\nx")])],
    [
      "a line feed that is not first in a <pre>'s branch",
      node("pre", [], [createIf([branch([text("x\n")])], at)]),
    ],
    [
      "a line feed after a conditional that always renders an element",
      node(
        "pre",
        [],
        [createIf([branch([node("b")]), branch([node("i")], false)], at), text("\nx")],
      ),
    ],
    ["whitespace in an iframe", node("iframe", [], [text(" ")])],
    [
      "a list keyed by its item and a prop",
      node(
        "ul",
        [],
        [
          createFor(
            label(),
            ids.item,
            expression("item + label", 0, [
              ["item", ids.item],
              ["label", ids.label],
            ]),
            node("li"),
            at,
          ),
        ],
      ),
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
      node("p", [createSpreadAttribute(label(), [createSpreadKey("style", at)], false, at)]),
      "/attributes/0/keys/0/name",
      "must not be bound: a `style`",
    ],
    [
      "a spread's handler",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("onclick", at)], false, at)]),
      "/attributes/0/keys/0/name",
      "must be an attribute of <p>",
    ],
    [
      "a spread's key",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("key", at)], false, at)]),
      "/attributes/0/keys/0/name",
      "must be an attribute of <p>",
    ],
    [
      "a spread's hidden",
      node("p", [createSpreadAttribute(label(), [createSpreadKey("hidden", at)], false, at)]),
      "/attributes/0/keys/0/name",
      "Vue's server or Svelte",
    ],
    [
      "a spread's key that is written too",
      node("p", [
        createStaticAttribute("id", "a", at),
        createSpreadAttribute(label(), [createSpreadKey("id", at)], false, at),
      ]),
      "/attributes/1/keys/0/name",
      'must set "id" once',
    ],
    [
      "two spreads with a class",
      node("p", [
        createSpreadAttribute(label(), [createSpreadKey("class", at)], false, at),
        createSpreadAttribute(label(), [createSpreadKey("class", at)], false, at),
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
    // Angular's compiler and server DOM parse a style again (UF3022): they lowercase every
    // property, and know neither escapes nor comments.
    [
      "a custom property with an upper-case letter",
      node("p", [style(createBoundStyle("--Gap", label(), at))]),
      "/declarations/0/property",
      "must be in lower case",
    ],
    [
      "a static custom property with an upper-case letter",
      node("p", [style(createStaticStyle("--myColor", "red", at))]),
      "/declarations/0/property",
      "must be in lower case",
    ],
    [
      "a value with an escaped quote of its own kind",
      node("p", [style(createStaticStyle("content", '"a\\";b"', at))]),
      "/declarations/0/value",
      "Angular's style parser",
    ],
    [
      "a parenthesis in a string",
      node("p", [style(createStaticStyle("content", '"("', at))]),
      "/declarations/0/value",
      "Angular's style parser",
    ],
    [
      "a quote in a comment",
      node("p", [style(createStaticStyle("color", "red /* it's */", at))]),
      "/declarations/0/value",
      "Angular's style parser",
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
      node("textarea", [], [createFor(label(), ids.item, item(), node("b"), at)]),
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
    // React's and Astro's servers write nothing for what renders nothing, and the parser drops
    // the line feed after it; the other targets write a comment first.
    [
      "a line feed after a conditional without an else",
      node("pre", [], [createIf([branch([node("b")])], at), text("\nx")]),
      "/children/1/value",
      "must not start with a line feed",
    ],
    [
      "a line feed after a conditional with an empty branch",
      node("pre", [], [createIf([branch([]), branch([node("i")], false)], at), text("\nx")]),
      "/children/1/value",
      "must not start with a line feed",
    ],
    [
      "a line feed after a list",
      node("pre", [], [createFor(label(), ids.item, item(), node("b"), at), text("\nx")]),
      "/children/1/value",
      "must not start with a line feed",
    ],
    [
      "a line feed after a list in a <pre>'s branch",
      node(
        "pre",
        [],
        [
          createIf(
            [branch([createFor(label(), ids.item, item(), node("b"), at), text("\nx")])],
            at,
          ),
        ],
      ),
      "/children/0/branches/0/children/1/value",
      "must not start with a line feed",
    ],
    // An <iframe>'s content is raw text: the servers' escapes and comments stay as written.
    [
      "text in an iframe",
      node("iframe", [], [text("a & b")]),
      "/children/0/value",
      "must be only whitespace in a <iframe>",
    ],
    [
      "an interpolation in an iframe",
      node("iframe", [], [interpolation()]),
      "/children/0",
      "must not be in a <iframe>",
    ],
    [
      "a conditional of whitespace in an iframe",
      node("iframe", [], [createIf([branch([text(" ")])], at)]),
      "/children/0",
      "must not render text in a <iframe>",
    ],
    // Lists' keys (ADR-0036).
    [
      "a list keyed by a constant",
      node("ul", [], [createFor(label(), ids.item, code("1"), node("li"), at)]),
      "/children/0/key",
      "must read the list's item or index",
    ],
    [
      "a list keyed by a prop",
      node("ul", [], [createFor(label(), ids.item, label(), node("li"), at)]),
      "/children/0/key",
      "must read the list's item or index",
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
      "an element in an <option>",
      node("select", [], [node("option", [], [node("b", [], [text("a")])])]),
      "/children/0/children/0/tag",
      "must not be inside <option>: its content is text",
    ],
    [
      "an element in an <option>, through a branch",
      node("select", [], [node("option", [], [createIf([branch([node("b")])], at)])]),
      "/children/0/children/0/branches/0/children/0/tag",
      "must not be inside <option>",
    ],
    [
      "an element in a <textarea>",
      node("textarea", [], [node("b")]),
      "/children/0/tag",
      "must not be inside <textarea>",
    ],
    [
      "an SVG element in an <iframe>",
      node("iframe", [], [svg()]),
      "/children/0/tag",
      "must not be inside <iframe>",
    ],
    [
      "an SVG <title> that starts a branch",
      svg(createIf([branch([node("title", [], [text("a")])])], at)),
      "/children/0/branches/0/children/0/tag",
      "must not start a conditional's branch or a list's body in SVG",
    ],
    [
      "a bound <select> size",
      node("select", [bound("size")], [node("option", [], [text("a")])]),
      "/attributes/0/name",
      "must not be bound: it decides which option starts selected",
    ],
    [
      "an <option>'s disabled as a spread's key",
      node(
        "select",
        [],
        [
          node(
            "option",
            [createSpreadAttribute(label(), [createSpreadKey("disabled", at)], false, at)],
            [text("a")],
          ),
        ],
      ),
      "/children/0/attributes/0/keys/0/name",
      "must not be bound: it decides which option starts selected",
    ],
    [
      "an attribute React's types do not declare",
      node("p", [createStaticAttribute("writingsuggestions", "false", at)]),
      "/attributes/0/name",
      "must not be set: React's and Vue's element types do not declare `writingsuggestions`",
    ],
    [
      "an attribute Vue's types do not declare",
      node("p", [createStaticAttribute("popover", "auto", at)]),
      "/attributes/0/name",
      "must not be set: Vue's element types do not declare `popover` (Vue's are the authoring types)",
    ],
    [
      "an ARIA 1.3 draft on an SVG element",
      svg(node("g", [createStaticAttribute("aria-description", "d", at)])),
      "/children/0/attributes/0/name",
      "is an ARIA 1.3 draft, which Vue's and Svelte's element types do not declare",
    ],
    [
      "a CSS property no browser knows",
      node("p", [style(createStaticStyle("colr", "red", at))]),
      "/attributes/0/declarations/0/property",
      "must be a CSS property the browsers know",
    ],
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
  > & { body: ElementNode };

/**
 * `withProps`' object form, with a `label` prop its `<p>` reads through `reference`, the text of
 * the reference.
 */
function objectForm(reference: string): UfModule {
  const module = withProps(["label"], "object");
  module.components[0]!.render = createElement(
    "p",
    [],
    [createInterpolation(expression(reference, 290, [[reference, "label@10"]]), at)],
    at,
  );
  return module;
}

/** `everyKind` with its list's item renamed `name`. */
function renamedItem(name: string): UfModule {
  return changed((module) => {
    const binding = createBinding(name, "loopVar", span(300, 300 + name.length));
    component(module).bindings[4] = binding;
    loop(module).item = binding.id;
    loop(module).body.children[0] = createInterpolation(
      expression(name, 360, [[name, binding.id]]),
      span(359, 360),
    );
  });
}

/** `everyKind` with a list in its list's body, whose item is `name` and key `key`. */
function nestedList(name: string, id: string, key: Expression): UfModule {
  return changed((module) => {
    component(module).bindings.push(createBinding(name, "loopVar", span(380, 380 + name.length)));
    loop(module).body.children.push(
      createFor(
        expression("items", 370, [["items", ids.items]]),
        id,
        key,
        createElement("b", [], [], at),
        at,
      ),
    );
  });
}

/**
 * A module declaring `interface Props`, with two components: each takes the props type named
 * first, and its props reach the types listed (`Props` among them, or not).
 */
function twoComponents(...components: [annotation: string, types: string[]][]): UfModule {
  const declarations = [
    createTypeDeclaration("Props", false, "interface Props {}", span(0, 18)),
    createTypeDeclaration("BadgeProps", false, "interface BadgeProps {}", span(20, 43)),
    createTypeDeclaration("Other", false, "interface Other {}", span(50, 68)),
  ];
  const used = new Set(components.flatMap(([, types]) => types));
  return createModule(
    "A.uf.tsx",
    components.map(([annotation, types], index) =>
      createComponent(
        index ? "B" : "A",
        createElement("p", [], [], at),
        span(100 * (index + 1), 100 * (index + 1) + 50),
        [],
        createPropsParameter(
          "destructured",
          createTypeText(
            annotation,
            span(100 * (index + 1), 100 * (index + 1) + annotation.length),
          ),
          at,
        ),
        types.toSorted(
          (a, b) =>
            ["Props", "BadgeProps", "Other"].indexOf(a) -
            ["Props", "BadgeProps", "Other"].indexOf(b),
        ),
      ),
    ),
    components.map((_, index) => createExport("named", index ? "B" : "A", at)),
    declarations.filter(({ name }) => used.has(name)),
  );
}

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
    ["a prop read through the object form", () => objectForm("props.label")],
    ["a prop read through the object form across lines", () => objectForm("props /* p */\n.label")],
    [
      "a local `Props` every component that reaches it takes as its props",
      () => twoComponents(["Props", ["Props"]], ["Props", ["Props"]]),
    ],
    [
      "a local `Props` beside a component that does not reach it",
      () => twoComponents(["Props", ["Props"]], ["Other", ["Other"]]),
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
      "declares its events with `defineEmits`",
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
      () => {
        const module = withProps(["a"], "object");
        module.components[0]!.props[0]!.default = expression('"a"', 11);
        return module;
      },
      "/props/0/default",
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
      () => {
        const module = withProps(["a", "b"], "object");
        delete module.components[0]!.props[1]!.binding;
        module.components[0]!.bindings.splice(1, 1);
        return module;
      },
      "/props/1",
      "must have a binding in the object form",
    ],
    [
      "an object form's parameter named as Astro's compiled component names its own",
      () => {
        const module = withProps(["a"], "object");
        module.components[0]!.propsParameter!.name = "$$props";
        return module;
      },
      "/propsParameter/name",
      "Astro's compiled component declares",
    ],
    // A prop's reference spans what each form reads (ADR-0035): the targets splice there.
    [
      "a prop read by its name in the object form",
      () => objectForm("label"),
      "/value/refs/0/span",
      'must span "props.label"',
    ],
    [
      "a prop read through another name than the parameter's",
      () => {
        const module = objectForm("props.label");
        module.components[0]!.propsParameter!.name = "p";
        return module;
      },
      "/value/refs/0/span",
      'must span "p.label"',
    ],
    [
      "a prop read as a member in the destructured form",
      () => {
        const module = objectForm("props.label");
        const { propsParameter } = module.components[0]!;
        delete propsParameter!.name;
        propsParameter!.form = "destructured";
        return module;
      },
      "/value/refs/0/span",
      'must span "label"',
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
    // Loop variables that a target's rewrite or an output would capture (UF3024).
    [
      "a loop variable named after a prop",
      () => renamedItem("tone"),
      "/children/0/children/0/item",
      'must not be named "tone": it would shadow the prop "tone"',
    ],
    [
      "a loop variable named as an Angular keyword",
      () => renamedItem("as"),
      "/children/0/children/0/item",
      "a keyword in Angular's template expressions",
    ],
    [
      "a loop variable named as Vue's compiled code names its own",
      () => renamedItem("_ctx"),
      "/children/0/children/0/item",
      "Vue's compiled render functions declare",
    ],
    [
      "a loop variable named after one of a list around it",
      () => nestedList("item", "item@380", expression("item", 390, [["item", "item@380"]])),
      "/body/children/1/item",
      'it would shadow "item@300", a loop variable of a list around it',
    ],
    [
      "a key that reads a loop variable of a list around it",
      () =>
        nestedList(
          "other",
          "other@380",
          expression("other + item", 390, [
            ["other", "other@380"],
            ["item", ids.item],
          ]),
        ),
      "/body/children/1/key",
      'must not read "item@300", a loop variable of a list around it',
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
      "a type named as one the outputs import",
      () =>
        changed(
          (module) =>
            void module.types.push(
              createTypeDeclaration("Record", false, "type Record = {}", span(40, 56)),
            ),
        ),
      "/types/1/name",
      'must not be "Record": Solid\'s output spreads',
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
      "a local `Props` another component's props reach",
      () => twoComponents(["Props", ["Props"]], ["BadgeProps", ["Props", "BadgeProps"]]),
      "/types/0/name",
      'must not be "Props": the outputs declare a type of that name',
    ],
    [
      "a local `Props` no component takes as its props",
      () => twoComponents(["BadgeProps", ["Props", "BadgeProps"]], ["Other", ["Other"]]),
      "/types/0/name",
      'must not be "Props"',
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

/** `everyKind` with its counter, the component that uses every kind of the setup, changed. */
function counterChanged(change: (counter: UfComponent) => void): UfModule {
  const module = everyKind();
  change(module.components[1]!);
  return module;
}

/** A setup item of the counter, of the kind it has. */
const setupItem = <K extends SetupItem["kind"]>(
  counter: UfComponent,
  index: number,
  _kind: K,
): Extract<SetupItem, { kind: K }> => counter.setup[index] as Extract<SetupItem, { kind: K }>;

/** The counter's function at a setup index: a function item's, a callback, a getter or an effect. */
function fnAt(counter: UfComponent, index: number): FunctionCode {
  const found = counter.setup[index]!;
  switch (found.kind) {
    case "Function":
      return found.function;
    case "Derived":
      return found.getter;
    case "Watch":
    case "Lifecycle":
      return found.callback;
    case "WatchEffect":
      return found.effect;
    default:
      throw new Error(`setup/${index} has no function`);
  }
}

/** The getter of the counter's array watcher's first source, `() => start`. */
const sourceGetter = (counter: UfComponent) =>
  (
    setupItem(counter, 10, "Watch").sources[0] as Extract<
      Extract<SetupItem, { kind: "Watch" }>["sources"][number],
      { kind: "Getter" }
    >
  ).getter;

/** A child element of the counter's root `<div>`. */
const childAt = (counter: UfComponent, index: number) =>
  (counter.render as ElementNode).children[index] as ElementNode;

/** The button in the counter's list. */
const listButton = (counter: UfComponent) =>
  ((childAt(counter, 5).children[0] as Extract<RenderNode, { kind: "For" }>).body as ElementNode)
    .children[0] as ElementNode;

/** A listener of an element, and the function its handler writes in place. */
const listenerAt = (element: ElementNode, index: number) =>
  element.attributes[index] as EventAttribute;
const inlineAt = (element: ElementNode, index: number) =>
  (listenerAt(element, index).handler as Extract<EventAttribute["handler"], { kind: "Inline" }>)
    .function;

/** The interpolation the counter's `<output>` renders. */
const shown = (counter: UfComponent) => childAt(counter, 4).children[0] as InterpolationNode;

/**
 * Code at `start` whose references `refs` builds, each at the `nth` occurrence of a part of the
 * code.
 */
function codeAt(
  text: string,
  start: number,
  refs: (locate: (part: string, nth?: number) => Span, whole: Span) => CodeReference[] = () => [],
): Code {
  const whole = span(start, start + text.length);
  const locate = (part: string, nth = 0): Span => {
    let offset = -1;
    for (let found = 0; found <= nth; found++) offset = text.indexOf(part, offset + 1);
    if (offset === -1) throw new Error(`"${part}" is not in "${text}"`);
    return span(start + offset, start + offset + part.length);
  };
  return createCode(text, whole, refs(locate, whole));
}

/** An expression at `start` reading the bindings `[text, binding, call?]` at their first occurrence. */
function expressionAt(text: string, start: number, refs: [string, string, boolean?][]): Expression {
  const code = codeAt(text, start, (locate) =>
    refs.map(([part, binding, call]) => createBindingReference(binding, locate(part), false, call)),
  );
  return createExpression(code.code, code.span, code.refs as Expression["refs"]);
}

/** Gives a function a body at its body's start, which the function's span then covers. */
function withBody(fn: FunctionCode, body: (start: number) => Code): void {
  fn.body = body(fn.body.span.start);
  fn.span = span(fn.span.start, Math.max(fn.span.end, fn.body.span.end));
}

/** Where the counter's `return` is: between its last setup item and its render. */
const returnAt = () => find("return (");

/** The counter with one more `const` of `name` at its `return`, the last binding before the list's. */
function extraConst(name: string): UfModule {
  return counterChanged((counter) => {
    const where = returnAt();
    const binding = createBinding(name, "localConst", span(where.start, where.start + 1));
    counter.bindings.splice(12, 0, binding);
    counter.setup.push(
      createConstItem(binding.id, createCode("1", span(where.end, where.end + 1)), where),
    );
  });
}

/** A function at offset 9000 handling an event: `(event) => text`, its body at 9012. */
function handlerAt(
  parameter: string | undefined,
  event: string,
  text: string,
  refs: Parameters<typeof codeAt>[2],
): FunctionCode {
  const body = codeAt(text, 9012, refs);
  return createFunctionCode(
    parameter === undefined ? [] : [createParameter(parameter, span(9001, 9006), { event })],
    body,
    span(9000, body.span.end),
    { expression: !text.startsWith("{") },
  );
}

describe("checkInvariants on the setup, events and template refs", () => {
  it.each<[string, () => UfModule]>([
    ["the counter", everyKind],
    [
      "a getter that calls a function reading only static values",
      () =>
        counterChanged((counter) =>
          withBody(sourceGetter(counter), (start) =>
            codeAt("label(step)", start, (locate) => [
              createBindingReference(counterIds.label, locate("label"), false, true),
              createBindingReference(counterIds.step, locate("step")),
            ]),
          ),
        ),
    ],
    // A `function` declaration is hoisted: only what it reads and reaches counts.
    [
      "a getter that calls a function declaration declared after it",
      () =>
        counterChanged((counter) => {
          const label = setupItem(counter, 7, "Function");
          label.form = "declaration";
          delete label.function.expression;
          withBody(label.function, (start) => codeAt('{ return "x"; }', start, () => []));
          withBody(fnAt(counter, 1), (start) =>
            codeAt("label(2)", start, (locate) => [
              createBindingReference(counterIds.label, locate("label"), false, true),
            ]),
          );
        }),
    ],
    [
      "a local function passed as a value in client code",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 13), (start) =>
            codeAt("setTimeout(select)", start, (locate) => [
              createGlobalReference("setTimeout", locate("setTimeout")),
              createBindingReference(counterIds.select, locate("select")),
            ]),
          ),
        ),
    ],
    [
      "a click handler that takes its event as an Event",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 6).parameters[0]!.event = "Event";
        }),
    ],
    [
      "a post watcher that reads the DOM",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 10), (start) =>
            codeAt("console.log(input.value)", start, (locate) => [
              createGlobalReference("console", locate("console")),
              createBindingReference(counterIds.input, locate("input.value")),
            ]),
          ),
        ),
    ],
    // After `await nextTick()` the DOM has updated on every target (ADR-0007).
    [
      "a watcher that reads the DOM after `await nextTick()`",
      () =>
        counterChanged((counter) => {
          delete setupItem(counter, 10, "Watch").post;
          fnAt(counter, 10).async = true;
          delete fnAt(counter, 10).expression;
          withBody(fnAt(counter, 10), (start) =>
            codeAt("{ await nextTick(); console.log(input.value); }", start, (locate) => [
              createApiReference("nextTick", locate("nextTick")),
              createGlobalReference("console", locate("console")),
              createBindingReference(counterIds.input, locate("input.value")),
            ]),
          );
        }),
    ],
    // What `watchEffect` hands on to run later is tracked by no target (ADR-0048).
    [
      "`watchEffect` reading a setup `let` in a timer's callback",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 11), (start) =>
            codeAt("{ setTimeout(() => console.log(timer), 1); }", start, (locate) => [
              createGlobalReference("setTimeout", locate("setTimeout")),
              createGlobalReference("console", locate("console")),
              { ...createBindingReference(c.timer, locate("timer")), later: true },
            ]),
          ),
        ),
    ],
    // Storage, `history` and `document.title` read nothing a render changes (ADR-0048).
    [
      "a watcher that writes storage, the history and the title before the DOM updates",
      () =>
        counterChanged((counter) => {
          delete setupItem(counter, 10, "Watch").post;
          delete fnAt(counter, 10).expression;
          withBody(fnAt(counter, 10), (start) =>
            codeAt(
              '{ localStorage.setItem("a", "b"); window.history.replaceState(null, "", "?a"); document.title = "a"; }',
              start,
              (locate) => [
                createGlobalReference("localStorage", locate("localStorage")),
                createGlobalReference("window", locate("window")),
                createGlobalReference("document", locate("document")),
              ],
            ),
          );
        }),
    ],
    // Angular's lexer reads a JavaScript reserved word that is not its own keyword as a name.
    [
      "an event named as a JavaScript reserved word Angular reads as a name",
      () => withEvent("delete"),
    ],
    // A setup binding is private to the component: Angular's output aliases its output.
    ["an event named as a setup binding", () => withEvent("count")],
  ])("accepts %s", (_, build) => {
    const errors = checkInvariants(build());
    expect(errors, JSON.stringify(errors)).toEqual([]);
  });

  const c = counterIds;
  it.each<[string, () => UfModule, string, string, number?]>([
    // Setup items (ADR-0045).
    [
      "a setup item that names a binding of another kind",
      () =>
        counterChanged((counter) => {
          (counter.setup[2] as { kind: string }).kind = "Id";
        }),
      "/components/1/setup/2/binding",
      `must name a localConst binding, and "${c.input}" is not one`,
    ],
    [
      "a setup binding no item declares",
      () => counterChanged((counter) => void counter.setup.splice(3, 1)),
      "/components/1/bindings/6",
      `must be declared by one setup item, and "${c.id}" is by 0`,
    ],
    [
      "a setup binding two items declare",
      () => counterChanged((counter) => void counter.setup.push(createIdItem(c.id, returnAt()))),
      "/components/1/bindings/6",
      "is by 2",
      2,
    ],
    [
      "setup items out of order",
      () =>
        counterChanged((counter) => {
          const [state, derived] = counter.setup;
          counter.setup.splice(0, 2, derived!, state!);
        }),
      "/components/1/setup/1/span",
      "must follow the item before it",
    ],
    [
      "a setup item after the render",
      () =>
        counterChanged((counter) => {
          const { end } = counter.render.span;
          counter.setup[13]!.span = span(end, end + 1);
        }),
      "/components/1/setup/13/span",
      "must lie in the component, before its render",
    ],
    // Names (ADR-0045, UF2003).
    [
      "a setup binding named as Angular's constructor",
      () => extraConst("constructor"),
      "/components/1/bindings/12/name",
      "Angular's output declares the component class's constructor",
    ],
    [
      "a setup binding named as a React hook",
      () => extraConst("useCount"),
      "/components/1/bindings/12/name",
      "as a hook",
    ],
    [
      "a setup binding named as a prop",
      () => extraConst("start"),
      "/components/1/bindings/12/name",
      'must differ from the prop "start"\'s',
    ],
    [
      "two setup bindings of one name",
      () => extraConst("count"),
      "/components/1/bindings/12/name",
      'must differ from the setup binding "count"\'s',
    ],
    // Events a component declares (ADR-0047).
    [
      "an emit binding the declaration does not declare",
      () =>
        counterChanged((counter) =>
          counter.bindings.splice(12, 0, createBinding("notify", "emit", returnAt())),
        ),
      "/components/1/bindings/12",
      "must be the binding `emits` declares",
    ],
    [
      "events whose names differ only in case",
      () => withEvent("rEset"),
      "/components/1/emits/events/2/name",
      'must differ from "reset" by more than case',
    ],
    [
      "an event named as an event prop",
      () => withEvent("onClose"),
      "/components/1/emits/events/2/name",
      "`no-output-on-prefix`",
    ],
    [
      "an event named as a prop",
      () => withEvent("start"),
      "/components/1/emits/events/2/name",
      'must differ from the prop "start"\'s name',
    ],
    // Angular declares a member for each event, which its template statements read by name.
    [
      "an event named as an Angular keyword that is a reserved word",
      () => withEvent("if"),
      "/components/1/emits/events/2/name",
      "must not be \"if\", which Angular's output declares as a member its templates read: `if` is a keyword in Angular's template expressions",
    ],
    [
      "an event named as an Angular keyword",
      () => withEvent("as"),
      "/components/1/emits/events/2/name",
      "`as` is a keyword in Angular's template expressions",
    ],
    [
      "an event named as a global expressions read",
      () => withEvent("parseInt"),
      "/components/1/emits/events/2/name",
      "`parseInt` is a global expressions may read",
    ],
    [
      "an event named as Angular's constructor",
      () => withEvent("constructor"),
      "/components/1/emits/events/2/name",
      "`constructor` would be the Angular component class's constructor",
    ],
    [
      "an event whose Svelte prop a prop takes",
      () =>
        counterChanged((counter) => {
          const offset = find("items }").start + 6;
          const binding = createBinding("onreset", "prop", span(offset, offset + 1));
          const type = createTypeText("() => void", span(5000, 5010));
          counter.props.push(createProp("onreset", true, type, span(5000, 5010), binding.id));
          counter.bindings.splice(2, 0, binding);
        }),
      "/components/1/emits/events/1/name",
      'Svelte names its prop "onreset"',
    ],
    [
      "a required event member after an optional one",
      () =>
        counterChanged((counter) => {
          const [value, previous] = counter.emits!.events[0]!.parameters;
          value!.optional = true;
          delete previous!.optional;
        }),
      "/components/1/emits/events/0/parameters/1/optional",
      "a required member cannot follow an optional one",
    ],
    [
      "an event member named twice",
      () =>
        counterChanged((counter) => {
          counter.emits!.events[0]!.parameters[1]!.name = "value";
        }),
      "/components/1/emits/events/0/parameters/1/name",
      'no other member takes, and "value" is not',
    ],
    // References in the template (ADR-0045).
    [
      "a ref's value read without `.value`",
      () =>
        counterChanged((counter) => {
          const ref = shown(counter).value.refs[1]!;
          ref.span = span(ref.span.start, ref.span.start + "doubled".length);
        }),
      "/render/children/4/children/0/value/refs/1/span",
      'must span "doubled.value"',
    ],
    [
      "a call of a binding that is no function",
      () =>
        counterChanged((counter) => {
          Object.assign(shown(counter).value.refs[1]!, { call: true });
        }),
      "/render/children/4/children/0/value/refs/1/call",
      "only a local function is called",
    ],
    [
      "a shorthand reference to a ref's value",
      () =>
        counterChanged((counter) => {
          Object.assign(shown(counter).value.refs[1]!, { shorthand: true });
        }),
      "/render/children/4/children/0/value/refs/1/shorthand",
      'must be absent on a reference that spans "doubled.value"',
    ],
    [
      "a local function read as a value in the template",
      () =>
        counterChanged((counter) => {
          delete (shown(counter).value.refs[0] as { call?: true }).call;
        }),
      "/render/children/4/children/0/value/refs/0/binding",
      'must call the local function "label',
    ],
    [
      "an impure local function called in the template",
      () =>
        counterChanged((counter) => {
          shown(counter).value = expressionAt("select(doubled.value)", 9000, [
            ["select", c.select, true],
            ["doubled.value", c.doubled],
          ]);
        }),
      "/render/children/4/children/0/value/refs/0/binding",
      `must call only a pure local function in a template, and "${c.select}" is not: it emits "change"`,
    ],
    [
      "a template ref read in the template",
      () =>
        counterChanged((counter) => {
          shown(counter).value = expressionAt("input.value", 9000, [["input.value", c.input]]);
        }),
      "/render/children/4/children/0/value/refs/0/binding",
      "must not read the template ref",
    ],
    [
      "a setup `let` read in the template",
      () =>
        counterChanged((counter) => {
          shown(counter).value = expressionAt("timer", 9000, [["timer", c.timer]]);
        }),
      "/render/children/4/children/0/value/refs/0/binding",
      "must not read the setup `let`",
    ],
    [
      "`emit` read in the template",
      () =>
        counterChanged((counter) => {
          shown(counter).value = expressionAt("emit", 9000, [["emit", c.emit]]);
        }),
      "/render/children/4/children/0/value/refs/0/binding",
      "code calls `emit` only as an emit",
    ],
    // What the setup evaluates: initial values and getters (ADR-0045).
    [
      "a write in an initial value",
      () =>
        constValue("count.value = 1", (locate, whole) => [
          createWriteReference(c.count, "=", whole, locate("count.value"), locate("1")),
        ]),
      "/components/1/setup/4/value/refs/0",
      "must not write in an initial value",
    ],
    [
      "an emit in an initial value",
      () =>
        constValue('emit("reset")', (_, whole) => [createEmitReference(c.emit, "reset", whole)]),
      "/components/1/setup/4/value/refs/0",
      "must not emit in an initial value",
    ],
    [
      "`nextTick` in an initial value",
      () =>
        constValue("nextTick()", (locate) => [createApiReference("nextTick", locate("nextTick"))]),
      "/components/1/setup/4/value/refs/0",
      "must not call `nextTick` in an initial value",
    ],
    [
      "`nextTick` given a callback",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 12), (start) =>
            codeAt("{ nextTick(() => count.value); }", start, (locate) => [
              createApiReference("nextTick", locate("nextTick")),
              createBindingReference(c.count, locate("count.value")),
            ]),
          ),
        ),
      "/components/1/setup/12/callback/body/refs/0",
      "must be called without arguments: `await nextTick()` is its one form",
    ],
    [
      "a global only client code may read in an initial value",
      () => constValue("Date.now()", (locate) => [createGlobalReference("Date", locate("Date"))]),
      "/components/1/setup/4/value/refs/0/name",
      'must be a global an initial value may read, and "Date" is not one',
    ],
    [
      "a template ref read in an initial value",
      () =>
        constValue("input.value", (locate) => [
          createBindingReference(c.input, locate("input.value")),
        ]),
      "/components/1/setup/4/value/refs/0/binding",
      "must not read the template ref",
    ],
    [
      "a setup `let` read in a getter",
      () =>
        counterChanged((counter) =>
          withBody(sourceGetter(counter), (start) =>
            codeAt("timer", start, (locate) => [createBindingReference(c.timer, locate("timer"))]),
          ),
        ),
      "/components/1/setup/10/sources/0/getter/body/refs/0/binding",
      'must not read the setup `let` "timer',
    ],
    [
      "a getter that calls a function reading a prop",
      () =>
        counterChanged((counter) => {
          withBody(fnAt(counter, 7), (start) =>
            codeAt("String(start)", start, (locate) => [
              createGlobalReference("String", locate("String")),
              createBindingReference(c.start, locate("start")),
            ]),
          );
          withBody(sourceGetter(counter), (start) =>
            codeAt("label(1)", start, (locate) => [
              createBindingReference(c.label, locate("label"), false, true),
            ]),
          );
        }),
      "/components/1/setup/10/sources/0/getter/body/refs/0/binding",
      `which Qwik hoists out of the component, and "${c.label}" reads "${c.start}"`,
    ],
    [
      "an initial value that reads what is declared after it",
      () =>
        counterChanged((counter) => {
          const state = setupItem(counter, 0, "State");
          state.initial = codeAt("doubled.value", state.initial!.span.start, (locate) => [
            createBindingReference(c.doubled, locate("doubled.value")),
          ]);
        }),
      "/components/1/setup/0/initial",
      `must read only what is declared before it, and "${c.doubled}" is not`,
    ],
    [
      "a getter that calls a function declared after it",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 1), (start) =>
            codeAt("label(2)", start, (locate) => [
              createBindingReference(c.label, locate("label"), false, true),
            ]),
          ),
        ),
      "/components/1/setup/1/getter",
      `must read only what is declared before it, and "${c.label}" is not`,
    ],
    // Writes, emits and the order of code references (ADR-0045, ADR-0047).
    [
      "a write of a derived value",
      () =>
        counterChanged((counter) => {
          Object.assign(fnAt(counter, 6).body.refs[1]!, { binding: c.doubled });
        }),
      "/components/1/setup/6/function/body/refs/1/binding",
      'must name a state, a model or a setup `let`, and "doubled',
    ],
    [
      "a write whose target is not the ref's value",
      () =>
        counterChanged((counter) => {
          const write = fnAt(counter, 6).body.refs[1] as { target: Span };
          write.target = span(write.target.start, write.target.start + "count".length);
        }),
      "/components/1/setup/6/function/body/refs/1/target",
      'must span "count.value" in the write',
    ],
    [
      "an update with a value",
      () =>
        counterChanged((counter) => {
          const update = fnAt(counter, 12).body.refs[2] as { target: Span; value?: Span };
          update.value = update.target;
        }),
      "/components/1/setup/12/callback/body/refs/2/value",
      'must be absent for "++"',
    ],
    [
      "an assignment without a value",
      () => counterChanged((counter) => void delete resetWrite(counter).value),
      "/render/children/3/attributes/1/handler/function/body/refs/0/value",
      'must be present for "="',
    ],
    [
      "an arrow's whole-body write without its flag",
      () => counterChanged((counter) => void delete resetWrite(counter).arrowBody),
      "/render/children/3/attributes/1/handler/function/body/refs/0/arrowBody",
      "must be set: the write is the arrow's whole body",
    ],
    [
      "a reference in a write's target",
      () =>
        counterChanged((counter) => {
          const [write, global] = fnAt(counter, 12).body.refs;
          global!.span = (write as { target: Span }).target;
        }),
      "/components/1/setup/12/callback/body/refs/1/span",
      "must lie in the value of the write or an argument of the emit it is in",
    ],
    [
      "code references out of order",
      () =>
        counterChanged((counter) => {
          const { refs } = fnAt(counter, 6).body;
          refs.splice(4, 2, refs[5]!, refs[4]!);
        }),
      "/components/1/setup/6/function/body/refs/5/span",
      "must follow the reference before it",
    ],
    [
      "an emit of an undeclared event",
      () =>
        counterChanged((counter) => {
          Object.assign(fnAt(counter, 6).body.refs[3]!, { event: "save" });
        }),
      "/components/1/setup/6/function/body/refs/3/event",
      'must name an event the component declares, and "save" is not one',
    ],
    [
      "an emit with more arguments than its event takes",
      () =>
        counterChanged((counter) => {
          const emit = inlineAt(counter.render as ElementNode, 0).body.refs[0] as {
            span: Span;
            arguments: Span[];
          };
          emit.arguments = [span(emit.span.start + 5, emit.span.end - 1)];
        }),
      "/render/attributes/0/handler/function/body/refs/0/arguments",
      'must pass 0 arguments to "reset", and passes 1',
    ],
    [
      "an emit with fewer arguments than its event takes",
      () =>
        counterChanged((counter) => {
          Object.assign(fnAt(counter, 8).body.refs[0]!, { arguments: [] });
        }),
      "/components/1/setup/8/function/body/refs/0/arguments",
      'must pass 1 to 2 arguments to "change", and passes 0',
    ],
    [
      "an emit of another binding",
      () =>
        counterChanged((counter) => {
          Object.assign(fnAt(counter, 8).body.refs[0]!, { binding: c.count });
        }),
      "/components/1/setup/8/function/body/refs/0/binding",
      "must name the `emit` that `emits` declares",
    ],
    // A handler's event (ADR-0047).
    [
      "an event read outside a handler",
      () =>
        counterChanged((counter) => {
          const { refs } = fnAt(counter, 13).body;
          refs[1] = createEventReference("type", refs[1]!.span);
        }),
      "/components/1/setup/13/callback/body/refs/1",
      "must be in the body of a function with an event parameter",
    ],
    [
      "an event member React's synthetic event lacks",
      () =>
        counterChanged((counter) => {
          const input = childAt(counter, 1);
          const handler = listenerAt(input, 2).handler as { function: FunctionCode };
          handler.function = handlerAt(
            "event",
            "KeyboardEvent",
            "{ console.log(event.isComposing); }",
            (locate) => [
              createGlobalReference("console", locate("console")),
              createEventReference("isComposing", locate("event.isComposing")),
            ],
          );
        }),
      "/render/children/1/attributes/2/handler/function/body/refs/1/member",
      'must be a member every target\'s KeyboardEvent has (`PORTABLE_EVENT_MEMBERS`), and "isComposing"',
      2,
    ],
    [
      "an event member React's event of that event lacks",
      () =>
        counterChanged((counter) => {
          const handler = listenerAt(listButton(counter), 1).handler as {
            function: FunctionCode;
          };
          handler.function = handlerAt(
            "event",
            "PointerEvent",
            "console.log(event.pointerType)",
            (locate) => [
              createGlobalReference("console", locate("console")),
              createEventReference("pointerType", locate("event.pointerType")),
            ],
          );
        }),
      "/children/0/attributes/1/handler",
      'must use only the members every target\'s "click" event has, and `pointerType` is not one',
    ],
    [
      "an event method read without a call",
      () =>
        counterChanged((counter) => {
          const handler = listenerAt(childAt(counter, 1), 2).handler as {
            function: FunctionCode;
          };
          handler.function = handlerAt(
            "event",
            "KeyboardEvent",
            "console.log(event.preventDefault)",
            (locate) => [
              createGlobalReference("console", locate("console")),
              createEventReference("preventDefault", locate("event.preventDefault")),
            ],
          );
        }),
      "/render/children/1/attributes/2/handler/function/body/refs/1/call",
      'must be set: "preventDefault" is a method',
    ],
    [
      "event controls without an event parameter",
      () =>
        counterChanged((counter) => {
          const fn = fnAt(counter, 13);
          fn.eventControls = [createEventControl("preventDefault", fn.body.span)];
        }),
      "/components/1/setup/13/callback/eventControls",
      "must be absent on a function without an event parameter",
    ],
    [
      "an event control whose condition is not the body's code",
      () =>
        counterChanged((counter) => {
          const control = inlineAt(childAt(counter, 1), 2).eventControls![0]!;
          control.condition!.code = 'event.key === "Enter!"';
        }),
      "/render/children/1/attributes/2/handler/function/eventControls/0/condition",
      "must be the body's code at its span",
    ],
    [
      "an event control without its call",
      () =>
        counterChanged((counter) => {
          const fn = fnAt(counter, 6);
          fn.eventControls![0]!.span = piece("count.value += step;").span;
        }),
      "/components/1/setup/6/function/eventControls/0/span",
      "must hold the call of `preventDefault`",
    ],
    [
      "a handler that takes another event's interface",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 6).parameters[0]!.event = "KeyboardEvent";
        }),
      "/render/children/2/attributes/1/handler",
      'must take "click" as PointerEvent or an interface it extends, and KeyboardEvent is not one',
      2,
    ],
    [
      "an event interface outside the vocabulary",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 8).parameters[0]!.event = "MessageEvent";
        }),
      "/components/1/setup/8/function/parameters/0/event",
      'must be an event interface of the vocabulary (`EVENT_INTERFACES`), and "MessageEvent"',
    ],
    [
      "an event parameter of a watch callback",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 9).parameters[0]!.event = "Event";
        }),
      "/components/1/setup/9/callback/parameters/0/event",
      "only a handler's or a setup function's parameter is an event",
    ],
    [
      "two event parameters",
      () =>
        counterChanged((counter) => {
          const fn = fnAt(counter, 6);
          const after = fn.parameters[0]!.span.end;
          fn.parameters.push(createParameter("other", span(after, after + 1), { event: "Event" }));
        }),
      "/components/1/setup/6/function/parameters/1/event",
      "a function takes one event",
    ],
    [
      "a handler's parameter that is not its event's",
      () =>
        counterChanged((counter) => {
          const fn = inlineAt(counter.render as ElementNode, 0);
          fn.parameters.push(createParameter("event", span(fn.span.start, fn.span.start + 1)));
        }),
      "/render/attributes/0/handler/function/parameters/0/event",
      "must be set: a handler's parameter is its event's",
      2,
    ],
    // Parameters (ADR-0045, UF3024).
    [
      "a parameter named after a setup binding",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 8).parameters[0]!.name = "count";
        }),
      "/components/1/setup/8/function/parameters/0/name",
      'must not be named "count": it would shadow the setup binding "count"',
    ],
    [
      "a parameter named after a prop",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 8).parameters[0]!.name = "start";
        }),
      "/components/1/setup/8/function/parameters/0/name",
      'it would shadow the prop "start"',
    ],
    [
      "a handler's parameter named after its list's item",
      () =>
        counterChanged((counter) => {
          const handler = listenerAt(listButton(counter), 1).handler as {
            function: FunctionCode;
          };
          handler.function = handlerAt("item", "MouseEvent", "select(item)", (locate) => [
            createBindingReference(c.select, locate("select"), false, true),
            createBindingReference(c.item, locate("item")),
          ]);
        }),
      "/children/0/attributes/1/handler/function/parameters/0/name",
      `it would shadow "${c.item}", a loop variable of a list around it`,
    ],
    [
      "a parameter's default that reads a binding",
      () =>
        counterChanged((counter) => {
          const parameter = fnAt(counter, 7).parameters[1]!;
          parameter.default = expressionAt("[step]", 9000, [["step", c.step]]);
        }),
      "/components/1/setup/7/function/parameters/1/default/refs",
      "must be empty: a default is static",
    ],
    [
      "an optional parameter with a default",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 7).parameters[1]!.optional = true;
        }),
      "/components/1/setup/7/function/parameters/1/default",
      "must be absent on an optional or a rest parameter",
    ],
    [
      "a rest parameter before the last",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 7).parameters[2]!.rest = true;
        }),
      "/components/1/setup/7/function/parameters/2/rest",
      "must be absent but on the last parameter",
    ],
    [
      "a parameter with a name and a pattern",
      () =>
        counterChanged((counter) => {
          const parameter = fnAt(counter, 7).parameters[0]!;
          parameter.pattern = createParameterPattern("[a]", ["a"], span(9000, 9003));
        }),
      "/components/1/setup/7/function/parameters/0",
      "must have a name or a pattern, and not both",
    ],
    [
      "a pattern that binds a name that is not an identifier",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 7).parameters[1]!.pattern!.names.push("é");
        }),
      "/components/1/setup/7/function/parameters/1/pattern/names/1",
      "it is not an ASCII identifier",
    ],
    [
      "two parameters of one name",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 7).parameters[2]!.name = "value";
        }),
      "/components/1/setup/7/function/parameters/2/name",
      "another parameter of the function takes it",
    ],
    // What each function's role takes (ADR-0045, ADR-0048).
    [
      "a watch callback with four parameters",
      () =>
        counterChanged((counter) => {
          pushParameter(fnAt(counter, 9));
        }),
      "/components/1/setup/9/callback/parameters",
      "must hold at most 3",
    ],
    [
      "a getter with a parameter",
      () =>
        counterChanged((counter) => {
          pushParameter(fnAt(counter, 1));
        }),
      "/components/1/setup/1/getter/parameters",
      "must hold at most 0: a getter takes none",
    ],
    [
      "a lifecycle hook with a parameter",
      () =>
        counterChanged((counter) => {
          pushParameter(fnAt(counter, 13));
        }),
      "/components/1/setup/13/callback/parameters",
      "a lifecycle hook takes none",
    ],
    [
      "a watch callback with a rest parameter",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 9).parameters[2]!.rest = true;
        }),
      "/components/1/setup/9/callback/parameters/2",
      "must be a plain parameter",
    ],
    [
      "an asynchronous getter",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 1).async = true;
        }),
      "/components/1/setup/1/getter/async",
      "must be absent: a getter is pure",
    ],
    [
      "a block body flagged as an expression",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 11).expression = true;
        }),
      "/components/1/setup/11/effect/expression",
      "must be absent: the body is a block",
    ],
    [
      "an expression body without its flag",
      () => counterChanged((counter) => void delete fnAt(counter, 13).expression),
      "/components/1/setup/13/callback/expression",
      "must be set: the body is an expression",
    ],
    [
      "a function declaration with an expression body",
      () =>
        counterChanged((counter) => {
          setupItem(counter, 7, "Function").form = "declaration";
        }),
      "/components/1/setup/7/form",
      'must be "arrow"',
    ],
    [
      "a setup function whose body is a write",
      () =>
        counterChanged((counter) => {
          const select = setupItem(counter, 8, "Function");
          select.form = "arrow";
          select.function.expression = true;
          withBody(select.function, (start) =>
            codeAt("count.value++", start, (locate, whole) => [
              createWriteReference(c.count, "++", whole, locate("count.value"), undefined, true),
            ]),
          );
        }),
      "/components/1/setup/8/function/body",
      "must be a block: a setup function returns no write",
    ],
    [
      "a local function that calls itself",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 8), (start) =>
            codeAt("{ select(entry); }", start, (locate) => [
              createBindingReference(c.select, locate("select"), false, true),
            ]),
          ),
        ),
      "/components/1/setup/8/binding",
      "must not call itself",
    ],
    [
      "a return type that is not its span's length",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 7).returnType!.code = "str";
        }),
      "/components/1/setup/7/function/returnType/code",
      "must be the source at its span",
    ],
    // Watchers (ADR-0048).
    [
      "a watched binding that is no ref",
      () =>
        counterChanged((counter) => {
          Object.assign(setupItem(counter, 9, "Watch").sources[0]!, { binding: c.step });
        }),
      "/components/1/setup/9/sources/0/binding",
      'must name a state or a derived value, and "step',
    ],
    [
      "a watcher of one source with two",
      () =>
        counterChanged((counter) => {
          const watcher = setupItem(counter, 9, "Watch");
          watcher.sources.push(createRefSource(c.doubled, watcher.sources[0]!.span));
        }),
      "/components/1/setup/9/sources",
      "must hold one source, or `array` be set",
    ],
    [
      "an array watcher without sources",
      () =>
        counterChanged((counter) => {
          setupItem(counter, 10, "Watch").sources = [];
        }),
      "/components/1/setup/10/sources",
      "must hold a source",
    ],
    [
      "an immediate watcher that writes state",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 9), (start) =>
            codeAt("{ increment(); }", start, (locate) => [
              createBindingReference(c.increment, locate("increment"), false, true),
            ]),
          ),
        ),
      "/components/1/setup/9/callback",
      `must be safe on the server, as Vue runs an immediate watcher's first callback there, and it writes "${c.count}"`,
    ],
    [
      "an immediate watcher that awaits",
      () =>
        counterChanged((counter) => {
          fnAt(counter, 9).async = true;
        }),
      "/components/1/setup/9/callback",
      "it is asynchronous",
    ],
    [
      "an immediate watcher that runs after the DOM updates",
      () =>
        counterChanged((counter) => {
          setupItem(counter, 9, "Watch").post = true;
        }),
      "/components/1/setup/9/post",
      "must be absent on an immediate watcher",
    ],
    [
      "a watcher that reads the DOM before it updates",
      () =>
        counterChanged((counter) => {
          delete setupItem(counter, 10, "Watch").post;
          withBody(fnAt(counter, 10), (start) =>
            codeAt("console.log(input.value)", start, (locate) => [
              createGlobalReference("console", locate("console")),
              createBindingReference(c.input, locate("input.value")),
            ]),
          );
        }),
      "/components/1/setup/10/post",
      "must be set: the callback reads the DOM (a template ref)",
    ],
    [
      "a watcher that reads `window`'s scroll before the DOM updates",
      () =>
        counterChanged((counter) => {
          delete setupItem(counter, 10, "Watch").post;
          withBody(fnAt(counter, 10), (start) =>
            codeAt("console.log(window.scrollY)", start, (locate) => [
              createGlobalReference("console", locate("console")),
              createGlobalReference("window", locate("window")),
            ]),
          );
        }),
      "/components/1/setup/10/post",
      "must be set: the callback reads the DOM (`window`)",
    ],
    [
      "a watcher that reads the DOM before `await nextTick()`",
      () =>
        counterChanged((counter) => {
          delete setupItem(counter, 10, "Watch").post;
          fnAt(counter, 10).async = true;
          delete fnAt(counter, 10).expression;
          withBody(fnAt(counter, 10), (start) =>
            codeAt("{ console.log(input.value); await nextTick(); }", start, (locate) => [
              createGlobalReference("console", locate("console")),
              createBindingReference(c.input, locate("input.value")),
              createApiReference("nextTick", locate("nextTick")),
            ]),
          );
        }),
      "/components/1/setup/10/post",
      "must be set: the callback reads the DOM (a template ref) before `await nextTick()`",
    ],
    [
      "`watchEffect` reading a setup `let`",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 11), (start) =>
            codeAt("{ console.log(timer); }", start, (locate) => [
              createGlobalReference("console", locate("console")),
              createBindingReference(c.timer, locate("timer")),
            ]),
          ),
        ),
      "/components/1/setup/11/effect",
      "must read no setup `let`",
    ],
    [
      "a reference marked `later` in a getter",
      () =>
        counterChanged((counter) => {
          const [ref] = setupItem(counter, 1, "Derived").getter.body.refs;
          if (ref?.kind === "Binding") ref.later = true;
        }),
      "/components/1/setup/1/getter/body/refs/0/later",
      "must be absent in a getter, which runs nothing later",
    ],
    // Listeners (ADR-0047).
    [
      "a listener of a window event",
      () =>
        counterChanged((counter) => void (listenerAt(childAt(counter, 1), 2).event = "popstate")),
      "/render/children/1/attributes/2/event",
      'must be an event an element receives, and "popstate" only the window does',
    ],
    [
      "a listener of an event no target listens to alike",
      () => counterChanged((counter) => void (listenerAt(childAt(counter, 1), 2).event = "resize")),
      "/render/children/1/attributes/2/event",
      'must be an event every target listens to alike, and "resize" is not',
    ],
    [
      "a listener of an unknown event",
      () => counterChanged((counter) => void (listenerAt(childAt(counter, 1), 2).event = "keydwn")),
      "/render/children/1/attributes/2/event",
      "must be an event of the vocabulary (`DOM_EVENTS`)",
    ],
    [
      "a listener with two options",
      () => counterChanged((counter) => void (listenerAt(childAt(counter, 3), 1).capture = true)),
      "/render/children/3/attributes/1",
      "must set at most one option",
    ],
    [
      "a passive listener of a click",
      () =>
        counterChanged((counter) => {
          const listener = listenerAt(childAt(counter, 3), 1);
          delete listener.once;
          listener.passive = true;
        }),
      "/render/children/3/attributes/1/passive",
      'must be absent on "click"',
    ],
    [
      "two listeners of one event with one option set",
      () => counterChanged((counter) => void delete listenerAt(childAt(counter, 2), 2).capture),
      "/render/children/2/attributes/2",
      'must listen to "click" once with its options on an element',
    ],
    [
      "a listener in Angular's literal region",
      () =>
        counterChanged((counter) =>
          childAt(counter, 3).attributes.push(createStaticAttribute("title", "{{ a }}", at)),
        ),
      "/render/children/3/attributes/1",
      "must not be in Angular's literal region",
    ],
    [
      "a listener inside an element of Angular's literal region",
      () =>
        counterChanged((counter) =>
          childAt(counter, 5).attributes.push(createStaticAttribute("title", "{{ a }}", at)),
        ),
      "/children/0/attributes/1",
      "must not be in Angular's literal region",
    ],
    [
      "a handler that names no local function",
      () =>
        counterChanged((counter) => {
          Object.assign(listenerAt(childAt(counter, 2), 1).handler, { binding: c.count });
        }),
      "/render/children/2/attributes/1/handler/binding",
      `must name a local function, and "${c.count}" is not one`,
    ],
    // Template refs (ADR-0049).
    [
      "a ref attribute of a binding that is no template ref",
      () =>
        counterChanged((counter) => {
          Object.assign(childAt(counter, 1).attributes[1]!, { binding: c.count });
        }),
      "/render/children/1/attributes/1/binding",
      `must name a template ref, and "${c.count}" is not one`,
      2,
    ],
    [
      "a template ref two elements attach",
      () =>
        counterChanged((counter) =>
          childAt(counter, 0).attributes.push(createRefAttribute(c.input, at)),
        ),
      "/components/1/bindings/5",
      `must be attached by the \`ref\` of one element, and "${c.input}" is by 2`,
    ],
    [
      "a template ref no element attaches",
      () => counterChanged((counter) => void childAt(counter, 1).attributes.splice(1, 1)),
      "/components/1/bindings/5",
      "is by 0",
    ],
    [
      "a template ref in a list",
      () =>
        counterChanged((counter) => {
          const [ref] = childAt(counter, 1).attributes.splice(1, 1);
          listButton(counter).attributes.push(ref!);
        }),
      "/children/0/attributes/2",
      "must not be in a list",
    ],
    [
      "an element attached to two template refs",
      () =>
        counterChanged((counter) =>
          childAt(counter, 1).attributes.splice(1, 0, createRefAttribute(c.input, at)),
        ),
      "/render/children/1/attributes/2",
      "must attach the element to one template ref",
      2,
    ],
  ])("reports %s", (_, build, path, message, count = 1) => {
    const errors = checkInvariants(build());
    expect(errors, JSON.stringify(errors)).toHaveLength(count);
    expect(
      errors.some((error) => error.path.endsWith(path) && error.message.includes(message)),
      JSON.stringify(errors),
    ).toBe(true);
  });
});

describe("checkInvariants on narrowed reads", () => {
  const c = counterIds;
  /** The counter's `select` with `text` for its body, and the references `refs` builds. */
  const selectBody = (
    text: string,
    refs: (locate: (part: string, nth?: number) => Span) => CodeReference[],
  ) =>
    counterChanged((counter) => withBody(fnAt(counter, 13), (start) => codeAt(text, start, refs)));

  it.each<[string, () => UfModule]>([
    [
      "a prop's read and a member path off it, and a ref's value, narrowed in client code",
      () =>
        selectBody("console.log(items [0] .length, input.value.value, start)", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.items, locate("items"), false, false, [
            createNarrowedPath(locate("items"), "local"),
            createNarrowedPath(locate("items [0] .length"), "local"),
          ]),
          createBindingReference(c.input, locate("input.value"), false, false, [
            createNarrowedPath(locate("input.value"), "template"),
          ]),
          createBindingReference(c.start, locate("start"), false, false, [
            createNarrowedPath(locate("start"), "closure"),
          ]),
        ]),
    ],
    [
      "a compound write's target, narrowed where its operator reads it",
      () =>
        selectBody("count.value += 1", (locate) => [
          createWriteReference(
            c.count,
            "+=",
            locate("count.value += 1"),
            locate("count.value"),
            locate("1"),
            true,
            [createNarrowedPath(locate("count.value"), "local")],
          ),
        ]),
    ],
  ])("accepts %s", (_, build) => {
    const errors = checkInvariants(build());
    expect(errors, JSON.stringify(errors)).toEqual([]);
  });

  it.each<[string, () => UfModule, string, string]>([
    [
      "a narrowed read of a local function",
      () =>
        selectBody("setTimeout(increment)", (locate) => [
          createGlobalReference("setTimeout", locate("setTimeout")),
          createBindingReference(c.increment, locate("increment"), false, false, [
            createNarrowedPath(locate("increment"), "local"),
          ]),
        ]),
      "/narrowed",
      "only a prop's or a ref's value's read narrows",
    ],
    [
      "an empty list of narrowed paths",
      () =>
        selectBody("console.log(start)", (locate) => [
          createGlobalReference("console", locate("console")),
          { ...createBindingReference(c.start, locate("start")), narrowed: [] },
        ]),
      "/narrowed",
      "must hold a path, or be absent",
    ],
    [
      "a path that does not start at the read",
      () =>
        selectBody("console.log(items[0].length)", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.items, locate("items"), false, false, [
            createNarrowedPath(locate("[0].length"), "local"),
          ]),
        ]),
      "/narrowed/0/span",
      "must start at the read",
    ],
    [
      "paths out of order",
      () =>
        selectBody("console.log(items[0].length)", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.items, locate("items"), false, false, [
            createNarrowedPath(locate("items[0]"), "local"),
            createNarrowedPath(locate("items"), "local"),
          ]),
        ]),
      "/narrowed/1/span",
      "longer than the path before it",
    ],
    [
      "a path through a call",
      () =>
        selectBody("console.log(items.at(0).length)", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.items, locate("items"), false, false, [
            createNarrowedPath(locate("items.at(0)"), "local"),
          ]),
        ]),
      "/narrowed/0/span",
      "a member path off it",
    ],
    [
      "a path through `?.`",
      () =>
        selectBody("console.log(items?.[0].length)", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.items, locate("items"), false, false, [
            createNarrowedPath(locate("items?.[0]"), "local"),
          ]),
        ]),
      "/narrowed/0/span",
      "a member path off it",
    ],
    [
      "a member path narrowed across a closure",
      () =>
        selectBody("console.log(items[0])", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.items, locate("items"), false, false, [
            createNarrowedPath(locate("items[0]"), "closure"),
          ]),
        ]),
      "/narrowed/0/scope",
      "but on a destructured prop's own read",
    ],
    [
      "a ref's value narrowed across a closure",
      () =>
        selectBody("console.log(input.value)", (locate) => [
          createGlobalReference("console", locate("console")),
          createBindingReference(c.input, locate("input.value"), false, false, [
            createNarrowedPath(locate("input.value"), "closure"),
          ]),
        ]),
      "/narrowed/0/scope",
      "but on a destructured prop's own read",
    ],
    [
      "a getter narrowed by the template",
      () =>
        counterChanged((counter) =>
          withBody(fnAt(counter, 1), (start) =>
            codeAt("start * 2", start, (locate) => [
              createBindingReference(c.start, locate("start"), false, false, [
                createNarrowedPath(locate("start"), "template"),
              ]),
            ]),
          ),
        ),
      "/narrowed/0/scope",
      "must not be `template` outside client code",
    ],
    [
      "a narrowed target of a write that does not read it",
      () =>
        selectBody("count.value = 1", (locate) => [
          createWriteReference(
            c.count,
            "=",
            locate("count.value = 1"),
            locate("count.value"),
            locate("1"),
            true,
            [createNarrowedPath(locate("count.value"), "local")],
          ),
        ]),
      "/narrowed",
      "whose operator reads it",
    ],
    [
      "a write's narrowed path that is not its target",
      () =>
        selectBody("count.value++", (locate) => [
          createWriteReference(
            c.count,
            "++",
            locate("count.value++"),
            locate("count.value"),
            undefined,
            true,
            [createNarrowedPath(locate("count"), "local")],
          ),
        ]),
      "/narrowed",
      "one `local` path spanning the target",
    ],
  ])("reports %s", (_, build, path, message) => {
    const errors = checkInvariants(build());
    expect(errors, JSON.stringify(errors)).toHaveLength(1);
    expect(errors[0]!.path.endsWith(path), errors[0]!.path).toBe(true);
    expect(errors[0]!.message).toContain(message);
  });

  it("reports a narrowed read in a template expression that is not local", () => {
    const render = element(
      "p",
      [],
      [
        createInterpolation(
          createExpression("label", span(0, 5), [
            createBindingReference(ids.label, span(0, 5), false, false, [
              createNarrowedPath(span(0, 5), "template"),
            ]),
          ]),
          at,
        ),
      ],
    );
    const errors = checkInvariants(moduleOf(render));
    expect(errors.map((error) => error.message)).toEqual([
      "must not be `template` outside client code: only a handler's code is narrowed by the template around it",
    ]);
  });
});

/** The counter with one more event, after its others. */
function withEvent(name: string): UfModule {
  return counterChanged((counter) => {
    const { end } = counter.emits!.events.at(-1)!.span;
    counter.emits!.events.push(createEventDeclaration(name, [], span(end, end + 1)));
  });
}

/** The counter with its step `const` set to `text`, with the references `refs` builds. */
function constValue(source: string, refs: Parameters<typeof codeAt>[2]): UfModule {
  return counterChanged((counter) => {
    const step = setupItem(counter, 4, "Const");
    step.value = codeAt(source, step.value.span.start, refs);
  });
}

/** The write of the counter's reset button: `() => (count.value = 0)`. */
const resetWrite = (counter: UfComponent) =>
  inlineAt(childAt(counter, 3), 1).body.refs[0] as { value?: Span; arrowBody?: true };

/** Adds a parameter just before a function's body. */
function pushParameter(fn: FunctionCode): void {
  const before = fn.body.span.start - 1;
  fn.parameters.push(createParameter("extra", span(before, before)));
}
