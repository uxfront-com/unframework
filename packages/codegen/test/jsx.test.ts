import {
  createBinding,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createFor,
  createFragment,
  createIf,
  createInterpolation,
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
  createTypeText,
  span,
} from "@unframework/ir";
import type { Binding, ElementNode, FragmentNode, RenderNode, UfComponent } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import {
  boundJsxAttribute,
  formatOutput,
  js,
  jsxChildren,
  jsxContext,
  jsxNode,
  printExpression,
  styleKey,
  styleObject,
} from "../src/index.ts";
import type { JsxContextOptions, JsxDialect, RewriteRules } from "../src/index.ts";
import { expressionAt } from "./expressions.ts";
import type { ReferenceTarget } from "./expressions.ts";

const at = span(0, 0);
let offset = 1000;
/** An expression at a fresh offset of an imaginary source. */
const expr = (code: string, ...refs: ReferenceTarget[]) => {
  const expression = expressionAt(offset, code, ...refs);
  offset += code.length + 10;
  return expression;
};

const label = createBinding("label", "prop", span(10, 15));
const tone = createBinding("tone", "prop", span(17, 21));
const attrs = createBinding("attrs", "prop", span(23, 28));
const items = createBinding("items", "prop", span(30, 35));
const item = createBinding("item", "loopVar", span(60, 64));
const index = createBinding("index", "loopVar", span(66, 71));
const bindings: Binding[] = [label, tone, attrs, items, item, index];
const type = createTypeText("string", at);

/** A component over `render`, whose props are the four props above (`attrs` optional). */
function component(render: ElementNode | FragmentNode): UfComponent {
  return createComponent(
    "Badge",
    render,
    at,
    [
      createProp("label", false, type, at, label.id),
      createProp("tone", true, type, at, tone.id, expr('"info"')),
      createProp("attrs", true, type, at, attrs.id),
      createProp("items", false, type, at, items.id),
    ],
    createPropsParameter("destructured", createTypeText("BadgeProps", at), at),
    [],
    bindings,
  );
}

const el = (tag: string, attributes: ElementNode["attributes"], ...children: RenderNode[]) =>
  createElement(tag, attributes, children, at);
const text = (value: string) => createText(value, at);
const show = (code: string, ...refs: ReferenceTarget[]) =>
  createInterpolation(expr(code, ...refs), at);

/** Prints a render root through a dialect, with every placeholder spliced. */
function print(
  render: ElementNode | FragmentNode,
  options: Omit<JsxContextOptions, "component"> = {},
): string {
  const context = jsxContext({ ...options, component: component(render) });
  const node = jsxNode(render, context);
  return context.placeholders.print(() => printExpression(node));
}

/** Prints and formats a root as a component's return value, as a target's output reads. */
async function formatted(render: ElementNode | FragmentNode, options = {}): Promise<string> {
  const code = `x = ${print(render, options)};`;
  const outcome = await formatOutput({ path: "A.tsx", contents: code });
  if (outcome.error) throw new Error(`${outcome.error}\n${code}`);
  const value = outcome.file.contents.replace(/^x = /, "").replace(/;\n$/, "");
  // A multi-line JSX value is wrapped in parentheses and indented: unwrap it.
  const wrapped = /^\(\n([^]*)\n\)$/.exec(value);
  return wrapped ? wrapped[1]!.replace(/^ {2}/gm, "") : value;
}

/** Whether printed JSX parses as TSX, with oxc. */
function parses(code: string): string[] {
  return parseModule("A.tsx", `export const x = ${code};`).errors.map((error) => error.message);
}

describe("jsxNode", () => {
  it("prints elements, text and interpolations as JSX", () => {
    const render = el(
      "p",
      [createStaticAttribute("class", "greeting", at)],
      text("Hello, "),
      show("label", ["label", label]),
      text("!"),
      el("br", []),
    );
    const code = print(render);
    expect(code).toBe('<p class="greeting">Hello, {label}!<br /></p>');
    expect(parses(code)).toEqual([]);
  });

  it("prints a root fragment as `<>…</>`", () => {
    const code = print(
      createFragment([el("h1", [], text("a")), show("label", ["label", label])], at),
    );
    expect(code).toBe("<><h1>a</h1>{label}</>");
    expect(parses(code)).toEqual([]);
  });

  it("prints conditionals as ternary chains ending in null, never `&&`", () => {
    const chain = createIf(
      [
        createBranch(expr('tone === "warn"', ["tone", tone]), [el("b", [], text("!"))], at),
        createBranch(expr("label", ["label", label]), [text("text")], at),
        createBranch(expr("tone", ["tone", tone]), [], at),
        createBranch(undefined, [el("i", [], text("a")), show("label", ["label", label])], at),
      ],
      at,
    );
    const and = createIf([createBranch(expr("label", ["label", label]), [el("span", [])], at)], at);
    const code = print(el("div", [], chain, and));
    expect(code).toBe(
      '<div>{tone === "warn" ? <b>!</b> : label ? "text" : tone ? null : <><i>a</i>{label}</>}{label ? <span /> : null}</div>',
    );
    expect(parses(code)).toEqual([]);
  });

  it("nests a branch's conditional and list as expressions", () => {
    const list = createFor(
      expr("items", ["items", items]),
      item.id,
      expr("item", ["item", item]),
      el("li", [], show("item", ["item", item])),
      at,
    );
    const nested = createIf(
      [
        createBranch(
          expr("label", ["label", label]),
          [createIf([createBranch(expr("tone", ["tone", tone]), [text("t")], at)], at)],
          at,
        ),
        createBranch(undefined, [list], at),
      ],
      at,
    );
    const code = print(el("ul", [], nested));
    expect(code).toBe(
      '<ul>{label ? tone ? "t" : null : items.map((item) => <li key={item}>{item}</li>)}</ul>',
    );
    expect(parses(code)).toEqual([]);
  });

  it("prints lists as `.map` with the key first and the index only when read", () => {
    const keyed = createFor(
      expr("items", ["items", items]),
      item.id,
      expr("item.id", ["item", item]),
      el("li", [createStaticAttribute("class", "row", at)], show("item.name", ["item", item])),
      at,
      index.id,
    );
    expect(print(el("ul", [], keyed))).toBe(
      '<ul>{items.map((item) => <li key={item.id} class="row">{item.name}</li>)}</ul>',
    );
    const indexed = createFor(
      expr("items", ["items", items]),
      item.id,
      expr("index", ["index", index]),
      el("li", [], show("item", ["item", item])),
      at,
      index.id,
    );
    expect(print(el("ul", [], indexed))).toBe(
      "<ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>",
    );
    // A target that prints no key (Solid's `<For>`) does not count it as a read.
    expect(print(el("ul", [], indexed), { includeKeys: false })).toBe(
      "<ul>{items.map((item) => <li key={index}>{item}</li>)}</ul>",
    );
  });

  it("splices expressions exactly as written: literals, spacing and comments", async () => {
    const render = el(
      "p",
      [createBoundAttribute("title", expr("`${label} x`", ["label", label]), at)],
      show("label.length * 1000 /* ms */ + 0.50", ["label", label]),
      show('label // the label\n  + "a\\x41"', ["label", label]),
    );
    const code = print(render);
    expect(code).toBe(
      '<p title={`${label} x`}>{label.length * 1000 /* ms */ + 0.50}{label // the label\n  + "a\\x41"}</p>',
    );
    expect(parses(code)).toEqual([]);
    expect(await formatted(render)).toContain("{label.length * 1000 /* ms */ + 0.5}");
  });

  it("parenthesises an expression where its slot needs it", () => {
    const list = createFor(
      expr("items ?? []", ["items", items]),
      item.id,
      expr("item", ["item", item]),
      el("li", []),
      at,
    );
    const branch = createIf(
      [
        createBranch(
          expr('label ? "a" : tone', ["label", label], ["tone", tone]),
          [el("b", [])],
          at,
        ),
      ],
      at,
    );
    const code = print(
      el("div", [], list, branch, show("label || tone", ["label", label], ["tone", tone])),
    );
    expect(code).toBe(
      '<div>{(items ?? []).map((item) => <li key={item} />)}{(label ? "a" : tone) ? <b /> : null}{label || tone}</div>',
    );
  });

  it("spells references by the context's rewrite rules", () => {
    const solid: RewriteRules = {
      binding: (_, binding, written) =>
        binding.kind === "prop" ? `props.${binding.name}` : binding === index ? "index()" : written,
    };
    const list = createFor(
      expr("items", ["items", items]),
      item.id,
      expr("item.id", ["item", item]),
      el(
        "li",
        [createBoundAttribute("title", expr("String({ label })", ["label", label]), at)],
        show("index + 1", ["index", index]),
      ),
      at,
      index.id,
    );
    expect(print(el("ul", [], list), { rules: solid })).toBe(
      "<ul>{props.items.map((item, index) => <li key={item.id} title={String({ label: props.label })}>{index() + 1}</li>)}</ul>",
    );
  });

  it("writes text a formatter could start a line with as a comment as a string", () => {
    const code = print(
      el(
        "p",
        [],
        text("// not a comment"),
        el("br", []),
        text("a /* b"),
        el("br", []),
        text("a//b and a/*b"),
      ),
    );
    expect(code).toBe('<p>{"// not a comment"}<br />{"a /* b"}<br />a//b and a/*b</p>');
  });
});

describe("every kind", () => {
  // One tree holding every node and attribute kind, each in every position the printer
  // distinguishes: printed with the defaults, it must parse as TSX and format.
  const everyKind = () =>
    createFragment(
      [
        el(
          "p",
          [
            createStaticAttribute("id", "a", at),
            createStaticAttribute("hidden", true, at),
            createBoundAttribute("title", expr("label", ["label", label]), at),
            createClassAttribute(
              [
                createStaticClass("a", at),
                createToggleClass("b", expr("label", ["label", label]), at),
                createDynamicClass(expr("tone", ["tone", tone]), at),
              ],
              at,
            ),
            createStyleAttribute(
              [
                createStaticStyle("color", "red", at),
                createBoundStyle("margin-top", expr("tone", ["tone", tone]), at),
              ],
              at,
            ),
            createSpreadAttribute(
              expr("attrs", ["attrs", attrs]),
              [createSpreadKey("class", at), createSpreadKey("data-x", at)],
              true,
              at,
            ),
          ],
          text("a "),
          show("label", ["label", label]),
          createIf(
            [
              createBranch(expr("tone", ["tone", tone]), [], at),
              createBranch(expr("label", ["label", label]), [show("label", ["label", label])], at),
              createBranch(undefined, [text("x"), el("br", [])], at),
            ],
            at,
          ),
        ),
        createFor(
          expr("items", ["items", items]),
          item.id,
          expr("item.id", ["item", item]),
          el(
            "li",
            [],
            createIf(
              [
                createBranch(
                  expr("index", ["index", index]),
                  [show("item.name", ["item", item])],
                  at,
                ),
              ],
              at,
            ),
          ),
          at,
          index.id,
        ),
        text("end"),
      ],
      at,
    );

  it("prints every node and attribute kind as TSX that parses and formats", async () => {
    const code = print(everyKind());
    expect(parses(code)).toEqual([]);
    expect(await formatted(everyKind())).toBe(
      [
        "<>",
        "  <p",
        '    id="a"',
        "    hidden",
        "    title={label}",
        '    class={["a", { b: label }, tone, attrs?.class]}',
        '    style={{ color: "red", marginTop: tone }}',
        '    data-x={attrs?.["data-x"]}',
        "  >",
        "    a {label}",
        "    {tone ? null : label ? (",
        "      label",
        "    ) : (",
        "      <>",
        "        x<br />",
        "      </>",
        "    )}",
        "  </p>",
        "  {items.map((item, index) => (",
        "    <li key={item.id}>{index ? item.name : null}</li>",
        "  ))}",
        "  end",
        "</>",
      ].join("\n"),
    );
  });
});

describe("attributes", () => {
  it("prints bound attributes as `name={expr}` under the dialect's name", () => {
    const dialect: JsxDialect = { attributeName: (name) => (name === "for" ? "htmlFor" : name) };
    const code = print(
      el("label", [
        createBoundAttribute("for", expr("label", ["label", label]), at),
        createStaticAttribute("hidden", true, at),
      ]),
      { dialect },
    );
    expect(code).toBe("<label htmlFor={label} hidden />");
  });

  it("prints a class from parts as an array, adjacent toggles as one object", async () => {
    const classes = createClassAttribute(
      [
        createStaticClass("a b", at),
        createDynamicClass(expr("tone", ["tone", tone]), at),
        createToggleClass("on", expr("label", ["label", label]), at),
        createToggleClass("text-sm", expr("tone", ["tone", tone]), at),
        createStaticClass("end", at),
        createToggleClass("off", expr("!label", ["label", label]), at),
      ],
      at,
    );
    expect(await formatted(el("p", [classes]))).toBe(
      '<p class={["a b", tone, { on: label, "text-sm": tone }, "end", { off: !label }]} />',
    );
  });

  it("merges a spread's class into the element's class", () => {
    const spread = createSpreadAttribute(
      expr("attrs", ["attrs", attrs]),
      [
        createSpreadKey("title", at),
        createSpreadKey("class", at),
        createSpreadKey("aria-label", at),
      ],
      true,
      at,
    );
    const classes = createClassAttribute(
      [createDynamicClass(expr("tone", ["tone", tone]), at)],
      at,
    );
    expect(print(el("p", [createStaticAttribute("class", "a b", at), spread]))).toBe(
      '<p class={["a b", attrs?.class]} title={attrs?.title} aria-label={attrs?.["aria-label"]} />',
    );
    expect(print(el("p", [spread, classes]))).toBe(
      '<p title={attrs?.title} aria-label={attrs?.["aria-label"]} class={[tone, attrs?.class]} />',
    );
    // Without a class of its own, the element takes the spread's.
    expect(print(el("p", [spread]))).toBe(
      '<p title={attrs?.title} class={attrs?.class} aria-label={attrs?.["aria-label"]} />',
    );
  });

  it("reads a spread's keys directly when its source is always there", () => {
    const spread = createSpreadAttribute(
      expr("item", ["item", item]),
      [createSpreadKey("title", at)],
      false,
      at,
    );
    expect(print(el("p", [spread]))).toBe("<p title={item.title} />");
  });

  // The analyser's `nullish`, not the printer, says when a source may be nullish: a member, a
  // conditional or an item may be, and a spread of nothing renders no key (ADR-0039).
  it("reads every key through `?.` when the spread's source may be nullish", () => {
    const spread = (code: string, ...names: ReferenceTarget[]) =>
      createSpreadAttribute(
        expr(code, ...names),
        [createSpreadKey("title", at), createSpreadKey("data-x", at)],
        true,
        at,
      );
    expect(print(el("p", [spread("item", ["item", item])]))).toBe(
      '<p title={item?.title} data-x={item?.["data-x"]} />',
    );
    expect(print(el("p", [spread("attrs.inner", ["attrs", attrs])]))).toBe(
      '<p title={attrs.inner?.title} data-x={attrs.inner?.["data-x"]} />',
    );
    expect(
      print(el("p", [spread("label ? undefined : attrs", ["label", label], ["attrs", attrs])])),
    ).toBe(
      '<p title={(label ? undefined : attrs)?.title} data-x={(label ? undefined : attrs)?.["data-x"]} />',
    );
  });

  it("prints a style as an object, static values as strings", async () => {
    const style = createStyleAttribute(
      [
        createStaticStyle("color", "red", at),
        createBoundStyle("margin-top", expr("tone", ["tone", tone]), at),
        createBoundStyle("--gap", expr("label", ["label", label]), at),
      ],
      at,
    );
    expect(await formatted(el("p", [style]))).toBe(
      '<p style={{ color: "red", marginTop: tone, "--gap": label }} />',
    );
    const context = jsxContext({ component: component(el("p", [style])) });
    const object = styleObject(style, context, "kebab");
    expect(context.placeholders.print(() => printExpression(object))).toBe(
      '({\n  color: "red",\n  "margin-top": tone,\n  "--gap": label\n})',
    );
  });

  it.each([
    ["margin-top", "marginTop", "margin-top"],
    ["--gap-size", "--gap-size", "--gap-size"],
    ["-webkit-line-clamp", "WebkitLineClamp", "-webkit-line-clamp"],
    ["-ms-transform", "msTransform", "-ms-transform"],
    ["float", "float", "float"],
  ])("keys the style property %s as %s or %s", (property, camel, kebab) => {
    expect(styleKey(property, "camel")).toBe(camel);
    expect(styleKey(property, "kebab")).toBe(kebab);
  });
});

describe("dialect hooks", () => {
  it("puts a conditional or list the dialect prints as an element straight into the children", () => {
    const dialect: JsxDialect = {
      conditional: (node, context) =>
        js.jsxElement(
          "Show",
          [
            js.jsxAttribute(
              "when",
              js.jsxExpressionContainer(
                context.placeholders.expression(node.branches[0]!.condition!.code),
              ),
            ),
          ],
          jsxChildren(node.branches[0]!.children, context),
        ),
    };
    const branch = createIf([createBranch(expr("label", ["label", label]), [text("yes")], at)], at);
    expect(print(el("p", [], branch), { dialect })).toBe("<p><Show when={label}>yes</Show></p>");
  });

  it("lets a dialect print an attribute kind, or every expression, its own way", () => {
    const dialect: JsxDialect = {
      boundAttribute: (attribute, element, context) =>
        boundJsxAttribute({ ...attribute, name: `bool:${attribute.name}` }, element, context),
      expression: (expression) => `String(${expression.code})`,
    };
    const render = el("input", [
      createBoundAttribute("disabled", expr("label", ["label", label]), at),
    ]);
    expect(print(el("p", [], render, show("tone", ["tone", tone])), { dialect })).toBe(
      "<p><input bool:disabled={String(label)} />{String(tone)}</p>",
    );
  });
});
