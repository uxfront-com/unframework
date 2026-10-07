// What every markup dialect must render (ADR-0035 to ADR-0040), as small IR trees with
// props and the HTML each must render for them. The markup targets' `markup-semantics` tests
// print the trees with their dialect, wrap them in a hand-written component that declares the
// props as their framework does, and compile and server-render them with the framework itself:
// what the dialect prints is under test, apart from what a target's emitter chooses to print.
// The trees are written as code snippets whose references the builder resolves, as the analyser
// would; the render-parity kit (./render-parity.ts) lowers authored sources instead.
import {
  ALLOWED_GLOBALS,
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createExpression,
  createFor,
  createFragment,
  createGlobalReference,
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
import type {
  Attribute,
  Binding,
  BindingId,
  ClassItem,
  ElementNode,
  Expression,
  FragmentNode,
  IfBranch,
  Prop,
  Reference,
  RenderNode,
  StyleDeclaration,
  UfComponent,
} from "@unframework/ir";

import { parseExpressionSource } from "../src/index.ts";
import type { RewriteRules } from "../src/index.ts";
import { comparableValue, parseHtml } from "./render-parity.ts";
import type { DomElement, DomNode } from "./render-parity.ts";

/** A prop of a case: its TypeScript type, and the value the case passes (none when absent). */
export interface PropSpec {
  type: string;
  value?: unknown;
}

/** One case: a tree, the props it reads, and the HTML it must render. */
export interface MarkupCase {
  name: string;
  props: Readonly<Record<string, PropSpec>>;
  /** Builds the tree: one element, or (in a root case) a fragment. */
  render(build: Builder): ElementNode | FragmentNode;
  /** What the tree renders for the props, as HTML: compared after {@link canonical}. */
  expected: string;
}

let nextOffset = 1;

/** A fresh source range for a piece of code, so every span and binding id is unique. */
function claim(length: number): number {
  const start = nextOffset;
  nextOffset += length + 1;
  return start;
}

/**
 * Builds IR for one case, resolving the references in code snippets as the analyser would:
 * loop variables (innermost first), then props, then allowed globals. Anything else is a
 * mistake in the case.
 */
export class Builder {
  readonly bindings: Binding[] = [];
  readonly propBindings: Map<string, Binding> = new Map();
  private readonly loops: Map<string, BindingId>[] = [];
  private readonly props: Readonly<Record<string, PropSpec>>;

  constructor(props: Readonly<Record<string, PropSpec>>) {
    this.props = props;
    for (const name of Object.keys(props)) {
      const at = claim(name.length);
      const binding = createBinding(name, "prop", span(at, at + name.length));
      this.bindings.push(binding);
      this.propBindings.set(name, binding);
    }
  }

  /** An expression whose references are found in its code. */
  e(code: string): Expression {
    const start = claim(code.length);
    const refs: Reference[] = [];
    const { expression } = parseExpressionSource(code);
    const resolve = (name: string): { binding: BindingId } | { global: string } | undefined => {
      for (const scope of this.loops.toReversed()) {
        const id = scope.get(name);
        if (id) return { binding: id };
      }
      const prop = this.propBindings.get(name);
      if (prop) return { binding: prop.id };
      return ALLOWED_GLOBALS.has(name) ? { global: name } : undefined;
    };
    const reference = (node: Identifier, locals: ReadonlySet<string>, shorthand: boolean) => {
      if (locals.has(node.name)) return;
      const found = resolve(node.name);
      if (found === undefined) throw new Error(`\`${node.name}\` in \`${code}\` is unresolved.`);
      const at = span(start + node.start, start + node.end);
      refs.push(
        "global" in found
          ? createGlobalReference(found.global, at)
          : createBindingReference(found.binding, at, shorthand),
      );
    };
    const visit = (value: unknown, locals: ReadonlySet<string>): void => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item, locals);
        return;
      }
      if (isIdentifier(value)) {
        reference(value, locals, false);
        return;
      }
      if (!isNode(value)) return;
      switch (value.type) {
        case "MemberExpression":
          visit(value.object, locals);
          if (value.computed) visit(value.property, locals);
          return;
        case "Property":
          if (value.shorthand && isIdentifier(value.value)) {
            reference(value.value, locals, true);
            return;
          }
          if (value.computed) visit(value.key, locals);
          visit(value.value, locals);
          return;
        case "ArrowFunctionExpression": {
          const params = Array.isArray(value.params) ? value.params.filter(isIdentifier) : [];
          visit(value.body, new Set([...locals, ...params.map(({ name }) => name)]));
          return;
        }
        default:
          for (const [key, child] of Object.entries(value)) {
            if (key !== "type" && typeof child === "object") visit(child, locals);
          }
      }
    };
    visit(expression, new Set());
    refs.sort((a, b) => a.span.start - b.span.start);
    return createExpression(code, span(start, start + code.length), refs);
  }

  el(tag: string, attributes: Attribute[] = [], ...children: (RenderNode | string)[]): ElementNode {
    return createElement(
      tag,
      attributes,
      children.map((child) => (typeof child === "string" ? this.text(child) : child)),
      here(),
    );
  }

  text(value: string): RenderNode {
    return createText(value, here());
  }

  i(code: string): RenderNode {
    return createInterpolation(this.e(code), here());
  }

  /** A conditional: `[condition, ...children]` per branch, `[undefined, ...]` for the else. */
  if(
    ...branches: [condition: string | undefined, ...children: (RenderNode | string)[]][]
  ): RenderNode {
    return createIf(
      branches.map(([condition, ...children]): IfBranch =>
        createBranch(
          condition === undefined ? undefined : this.e(condition),
          children.map((child) => (typeof child === "string" ? this.text(child) : child)),
          here(),
        ),
      ),
      here(),
    );
  }

  /** A list over `source`, with an item (and an index) variable in scope for the key and body. */
  for(
    source: string,
    item: string,
    index: string | undefined,
    key: string,
    body: () => ElementNode,
  ): RenderNode {
    const sourceExpression = this.e(source);
    const scope = new Map<string, BindingId>();
    const itemBinding = this.loopVariable(item, scope);
    const indexBinding = index === undefined ? undefined : this.loopVariable(index, scope);
    this.loops.push(scope);
    try {
      return createFor(sourceExpression, itemBinding, this.e(key), body(), here(), indexBinding);
    } finally {
      this.loops.pop();
    }
  }

  private loopVariable(name: string, scope: Map<string, BindingId>): BindingId {
    const at = claim(name.length);
    const binding = createBinding(name, "loopVar", span(at, at + name.length));
    this.bindings.push(binding);
    scope.set(name, binding.id);
    return binding.id;
  }

  attr(name: string, value: string | true = true): Attribute {
    return createStaticAttribute(name, value, here());
  }

  bind(name: string, code: string): Attribute {
    return createBoundAttribute(name, this.e(code), here());
  }

  /** A class from parts: a string is a static part, `[name, condition]` a toggle, `{ code }` dynamic. */
  cls(...items: (string | [name: string, condition: string] | { code: string })[]): Attribute {
    return createClassAttribute(
      items.map((item): ClassItem =>
        typeof item === "string"
          ? createStaticClass(item, here())
          : Array.isArray(item)
            ? createToggleClass(item[0], this.e(item[1]), here())
            : createDynamicClass(this.e(item.code), here()),
      ),
      here(),
    );
  }

  /** A style from declarations: `[property, value]` static, `[property, { code }]` bound. */
  style(...declarations: [property: string, value: string | { code: string }][]): Attribute {
    return createStyleAttribute(
      declarations.map(([property, value]): StyleDeclaration =>
        typeof value === "string"
          ? createStaticStyle(property, value, here())
          : createBoundStyle(property, this.e(value.code), here()),
      ),
      here(),
    );
  }

  /** A spread of `source`'s keys: a prop by its name, or code that says whether it is nullish. */
  spread(source: string | { code: string; nullish: boolean }, ...keys: string[]): Attribute {
    const { code, nullish } = typeof source === "string" ? this.propSource(source) : source;
    return createSpreadAttribute(
      this.e(code),
      keys.map((key) => createSpreadKey(key, here())),
      nullish,
      here(),
    );
  }

  /**
   * A prop as a spread's source: nullish, as the analyser would find, when the case leaves it
   * out (it is then declared optional) or its type ends in `| null` or `| undefined`.
   */
  private propSource(name: string): { code: string; nullish: boolean } {
    const spec = this.props[name];
    if (!spec) throw new Error(`\`${name}\` is no prop of the case.`);
    const passed = "value" in spec && spec.value !== undefined;
    return { code: name, nullish: !passed || /\|\s*(?:null|undefined)\s*$/.test(spec.type) };
  }

  fragment(...children: (RenderNode | string)[]): FragmentNode {
    return createFragment(
      children.map((child) => (typeof child === "string" ? this.text(child) : child)),
      here(),
    );
  }
}

interface Identifier {
  type: "Identifier";
  name: string;
  start: number;
  end: number;
}

interface Node {
  type: string;
  [key: string]: unknown;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

function isIdentifier(value: unknown): value is Identifier {
  return isNode(value) && value.type === "Identifier" && typeof value.name === "string";
}

const here = () => span(0, 0);

/** Cases built into one component, with the props its wrapper declares and passes. */
export interface Suite {
  component: UfComponent;
  /** Each prop by its name in the wrapper (`c3Label`): its type, and the value passed. */
  props: { name: string; type: string; value?: unknown; passed: boolean }[];
  /** The allowed globals the expressions read (Angular declares them as members). */
  globals: string[];
  cases: { name: string; expected: string }[];
  /** How a target spells a reference: a prop by its name in the wrapper, `call`ed on Angular. */
  rules(call: boolean): RewriteRules;
}

/**
 * Builds cases into one component: each case's tree is a child of a root `<div>` (or, for a
 * single root case, the root itself), and each case's props are namespaced (`c3Label`), so
 * one compile and one render check them all.
 */
export function suite(cases: readonly MarkupCase[], root: "div" | "self" = "div"): Suite {
  const bindings: Binding[] = [];
  const spelled = new Map<BindingId, string>();
  const props: Suite["props"] = [];
  const declared: Prop[] = [];
  const trees: (ElementNode | FragmentNode)[] = [];
  cases.forEach((each, index) => {
    const builder = new Builder(each.props);
    trees.push(each.render(builder));
    bindings.push(...builder.bindings);
    for (const [name, spec] of Object.entries(each.props)) {
      const spelling = `c${index}${name[0]!.toUpperCase()}${name.slice(1)}`;
      const binding = builder.propBindings.get(name)!.id;
      const passed = "value" in spec && spec.value !== undefined;
      spelled.set(binding, spelling);
      // A prop the case passes is required, as Angular declares it, so no `?.` reads it.
      declared.push(
        createProp(spelling, !passed, createTypeText(spec.type, here()), here(), binding),
      );
      props.push({
        name: spelling,
        type: spec.type,
        ...("value" in spec ? { value: spec.value } : {}),
        passed,
      });
    }
  });
  const render =
    root === "self" ? trees[0]! : createElement("div", [], trees.map(asElement), here());
  const globals = new Set<string>();
  const component = createComponent(
    "Cases",
    render,
    here(),
    declared,
    createPropsParameter("destructured", createTypeText("CasesProps", here()), here()),
    [],
    bindings.toSorted((a, b) => a.span.start - b.span.start),
  );
  return {
    component,
    props,
    globals: [...collectGlobals(render, globals)].toSorted(),
    cases: cases.map(({ name, expected }) => ({ name, expected })),
    rules: (call) => ({
      binding: (_, binding) =>
        binding.kind === "prop" ? `${spelled.get(binding.id)!}${call ? "()" : ""}` : binding.name,
    }),
  };
}

function asElement(tree: ElementNode | FragmentNode): ElementNode {
  if (tree.kind !== "Element") throw new Error("Only a root case's tree can be a fragment.");
  return tree;
}

/** The allowed globals a tree's expressions read. */
function collectGlobals(value: unknown, found: Set<string>): Set<string> {
  if (Array.isArray(value)) for (const item of value) collectGlobals(item, found);
  else if (typeof value === "object" && value !== null) {
    const node = value as { kind?: unknown; name?: unknown };
    if (node.kind === "Global" && typeof node.name === "string") found.add(node.name);
    for (const child of Object.values(value)) collectGlobals(child, found);
  }
  return found;
}

/**
 * HTML parsed as the kit parses a server render (comments dropped, text merged), with
 * self-closing foreign elements opened and closed, and canonical as ADR-0044 says frameworks
 * may differ: a `class` or `style` with nothing in it is no attribute, class tokens are sorted,
 * and style declarations without a value are dropped and the others sorted.
 */
export function canonical(html: string): DomNode[] {
  const expanded = html.replace(
    /<([A-Za-z][A-Za-z0-9]*)((?:\s+[^\s"'=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*\/>/g,
    (tag, name: string, attributes: string) =>
      /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i.test(name)
        ? tag
        : `<${name}${attributes}></${name}>`,
  );
  return parseHtml(expanded).map(canonicalNode);
}

function canonicalNode(node: DomNode): DomNode {
  if (typeof node === "string") return node;
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(node.attributes).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (name === "class") {
      const tokens = value.split(/[\t\n\f\r ]+/).filter(Boolean);
      if (tokens.length) attributes[name] = tokens.toSorted().join(" ");
    } else if (name === "style") {
      // Split outside strings, parentheses and comments: a `;` in a string ends no declaration.
      const declarations = comparableValue(name, value);
      if (declarations !== undefined) attributes[name] = declarations;
    } else attributes[name] = value;
  }
  return {
    tag: node.tag,
    attributes,
    children: node.children.map(canonicalNode),
  } satisfies DomElement;
}

/** What each case rendered, from a suite's rendered root `<div>`, beside what it should. */
export function compareSuite(
  rendered: readonly DomNode[],
  cases: Suite["cases"],
): { name: string; expected: DomNode[]; actual: DomNode[] }[] {
  const [root, ...rest] = rendered.map(canonicalNode);
  if (rest.length || typeof root !== "object" || root.tag !== "div") {
    throw new Error(`expected one root <div>, got ${JSON.stringify(rendered).slice(0, 300)}`);
  }
  if (root.children.length !== cases.length) {
    throw new Error(
      `expected ${cases.length} cases, got ${root.children.length}: ${JSON.stringify(root.children).slice(0, 300)}`,
    );
  }
  return cases.map(({ name, expected }, index) => ({
    name,
    expected: canonical(expected),
    actual: [root.children[index]!],
  }));
}

/** The props a wrapper passes: those a case gives a value. */
export function passedProps(props: Suite["props"]): Record<string, unknown> {
  return Object.fromEntries(
    props.filter(({ passed }) => passed).map(({ name, value }) => [name, value]),
  );
}

const item = (id: string, label: string, on = true) => ({ id, label, on });

/**
 * The cases, by what they show. Each holds only values inside the contract (ADR-0035): keys
 * are unique, arrays dense, numbers in attributes finite.
 */
export const MARKUP_CASES: readonly MarkupCase[] = [
  // Interpolations (ADR-0037): text, numbers, nothing for nullish, beside text.
  {
    name: "a string with markup and every template's delimiters",
    props: {
      s: { type: "string", value: `<b>&amp; {{ x }} {#if a} @if (b) {} }} "q" 'a' \\ {y} \${z}` },
    },
    render: (b) => b.el("p", [], b.i("s")),
    expected: `<p>&lt;b&gt;&amp;amp; {{ x }} {#if a} @if (b) {} }} "q" 'a' \\ {y} \${z}</p>`,
  },
  {
    name: "numbers",
    props: {
      zero: { type: "number", value: 0 },
      negative: { type: "number", value: -0 },
      large: { type: "number", value: 1e21 },
      fraction: { type: "number", value: 1.5 },
    },
    render: (b) =>
      b.el(
        "p",
        [],
        "[",
        b.i("zero"),
        "][",
        b.i("negative"),
        "][",
        b.i("large"),
        "][",
        b.i("fraction"),
        "]",
      ),
    expected: "<p>[0][0][1e+21][1.5]</p>",
  },
  {
    name: "nullish values beside text",
    props: { absent: { type: "string" }, none: { type: "string | null", value: null } },
    render: (b) => b.el("p", [], "a ", b.i("absent"), " b ", b.i("none"), " c"),
    expected: "<p>a  b  c</p>",
  },
  {
    name: "edge spaces around an interpolation",
    props: { s: { type: "string", value: "x" } },
    render: (b) => b.el("p", [], " ", b.i("s"), " "),
    expected: "<p> x </p>",
  },
  {
    name: "runs, tabs and line breaks beside interpolations",
    props: { s: { type: "string", value: "x" } },
    render: (b) => b.el("p", [], b.i("s"), "  \t", b.i("s"), "\n", b.i("s"), " ", b.i("s")),
    expected: "<p>x  \tx\nx x</p>",
  },
  {
    name: "a brace right before an interpolation",
    props: { s: { type: "string", value: "x" } },
    render: (b) => b.el("p", [], "{", b.i("s"), "}{{", b.i("s"), "}}"),
    expected: "<p>{x}{{x}}</p>",
  },
  {
    name: "string literals with delimiters, references and markup in code",
    props: { s: { type: "string", value: "x" } },
    render: (b) => b.el("p", [], b.i(`"}}" + s + "&amp;<b>{{" + '"' + "'"`)),
    expected: `<p>}}x&amp;amp;&lt;b&gt;{{"'</p>`,
  },
  {
    name: "template literals, comments and regular expressions in code",
    props: { s: { type: "string", value: "x" } },
    render: (b) =>
      b.el(
        "p",
        [],
        b.i("`${s}}}`"),
        "|",
        b.i("s /* }} {{ */ + `-${`}`}`"),
        "|",
        b.i(`/}}/.test("a}}") ? "y" : "n"`),
      ),
    expected: "<p>x}}|x-}|y</p>",
  },
  {
    name: "escapes Angular's lexer reads differently, and whitespace in strings",
    props: { s: { type: "string", value: "x" } },
    render: (b) =>
      b.el(
        "p",
        [],
        b.i(`"\\x41" + "\\u0042" + s`),
        "|",
        b.i(`"a  b\\tc"`),
        "|",
        b.i("1_000 + .5"),
        "|",
        b.i("`\\x41${s}\\u0060`"),
      ),
    expected: "<p>ABx|a  b\tc|1000.5|Ax`</p>",
  },
  {
    name: "a comparison and logical operators in code",
    props: { n: { type: "number", value: 2 }, s: { type: "string", value: "x" } },
    render: (b) =>
      b.el("p", [], b.i(`n<3 && s ? "lt" : "ge"`), "|", b.i("s && s.length > 0 ? s : 'none'")),
    expected: "<p>lt|x</p>",
  },
  {
    name: "allowed globals",
    props: { n: { type: "number", value: 7 } },
    render: (b) =>
      b.el("p", [], b.i("Math.max(n, 2)"), " ", b.i("String(n)"), " ", b.i("JSON.stringify([n])")),
    expected: "<p>7 7 [7]</p>",
  },
  {
    name: "a shorthand property",
    props: { s: { type: "string", value: "x" } },
    render: (b) => b.el("p", [], b.i("JSON.stringify({ s })")),
    expected: `<p>{"s":"x"}</p>`,
  },
  {
    // Angular's lexers find an interpolation's `}}`, a block's `;` and `)` and a comment's `//`
    // outside quotes, a regular expression's included, and its whitespace processing condenses
    // runs in one: the dialect writes escapes there.
    name: "regular expressions that hold quotes, `;`, parentheses, slashes and spaces",
    props: { s: { type: "string", value: `/a'b"c;d)e  f` } },
    render: (b) =>
      b.el(
        "p",
        [b.bind("title", `/'|"/.test(s) ? "quoted" : "plain"`)],
        b.i(`/'/.test(s) ? "q" : "p"`),
        "|",
        b.i('/"|`/.test(s) ? "q2" : "p2"'),
        "|",
        b.i(`/e  f/.test(s) ? "run" : "none"`),
        "|",
        b.i(`/^\\//.test(s) ? "slash" : "none"`),
        "|",
        b.i(`s.replace(/[;)]/g, "-")`),
        "|",
        b.if([`/[;)]/.test(s)`, b.el("b", [], "block")]),
        b.for(`s.split(/[;)]/)`, "part", undefined, "part", () => b.el("i", [], b.i("part"))),
      ),
    expected: `<p title="quoted">q|q2|run|slash|/a'b"c-d-e  f|<b>block</b><i>/a'b"c</i><i>d</i><i>e  f</i></p>`,
  },
  {
    // Angular's template lexer opens a tag at a `<` before a letter or `!`, in an interpolation
    // too: a named group, a named back-reference and a negative lookbehind hold one.
    name: "regular expressions with named groups and lookbehinds",
    props: { s: { type: "string", value: "aa" } },
    render: (b) =>
      b.el(
        "p",
        [],
        b.i(`s && /(?<x>a)\\k<x>/.test(s) ? "named" : "none"`),
        "|",
        b.i(`/(?<!b)a/.test(s) ? "behind" : "none"`),
      ),
    expected: "<p>named|behind</p>",
  },
  {
    // Angular turns U+E500, its `&ngsp;` marker, into a space in text and in interpolated
    // literals, in a `<pre>` too.
    name: "U+E500 in text and in string literals",
    props: { s: { type: "string", value: "s" } },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el(
          "p",
          [b.bind("title", 's + "\ue500"')],
          "x\ue500y",
          b.i('s + "\ue500"'),
          "|",
          b.i('"p\ue500q"'),
        ),
        b.el("pre", [], "a\ue500 b"),
      ),
    expected: '<div><p title="s\ue500">x\ue500ys\ue500|p\ue500q</p><pre>a\ue500 b</pre></div>',
  },
  {
    // Angular decodes an interpolation's references with `/&([^;]+);/`, so a bare `&` would take
    // the `;` of one after it, and its search for a comment knows no escapes, in text it writes
    // as a literal too (a run of spaces, U+E500).
    name: "ampersands before references, and quotes before a `//` in literal text",
    props: {
      s: { type: "string", value: "R&D" },
      on: { type: "boolean", value: true },
      t: { type: "string", value: "t" },
    },
    render: (b) =>
      b.el(
        "div",
        [b.bind("title", '(on&&s) || "none"')],
        b.el("p", [], b.i('on && /R&D/.test(s) ? "rd" : "other"'), "|", b.i('(on&&t) || "none"')),
        b.el("p", [], 'Visit "https://a.b".  Thanks'),
        b.el("p", [], 'a\ue500 "b//c'),
      ),
    expected: [
      '<div title="R&amp;D">',
      "<p>rd|t</p>",
      '<p>Visit "https://a.b".  Thanks</p>',
      '<p>a\ue500 "b//c</p>',
      "</div>",
    ].join(""),
  },
  {
    // angular-eslint lints the raw text of the template literal an Angular template sits in,
    // where a backslash is doubled: no quote, `/`, bracket or parenthesis may follow one.
    name: "apostrophes and quotes in strings, and escaped characters in regular expressions",
    props: {
      name: { type: "string", value: 'say "hi"' },
      saved: { type: "boolean", value: false },
    },
    render: (b) =>
      b.el(
        "div",
        [b.bind("title", `saved ? "Saved" : "Don't forget"`), b.bind("aria-label", "`${name}'s`")],
        b.el(
          "p",
          [],
          b.i(`saved ? "Saved" : 'Not "saved" yet'`),
          "|",
          b.i('name + "it\'s \\"x\\""'),
        ),
        b.el("p", [], 'Visit "https://a.b".  Thanks'),
        b.if([`name === 'say "hi"'`, b.el("b", [], "hi")]),
        b.el("p", [b.bind("title", '/a\\/b|[\\]]|\\(/.test(name) ? "match" : "none"')], "r"),
      ),
    expected: [
      `<div title="Don't forget" aria-label="say &quot;hi&quot;'s">`,
      `<p>Not "saved" yet|say "hi"it's "x"</p>`,
      '<p>Visit "https://a.b".  Thanks</p><b>hi</b><p title="none">r</p>',
      "</div>",
    ].join(""),
  },
  {
    // Angular's expression lexer reads only ASCII whitespace and the no-break space.
    name: "whitespace outside ASCII between an expression's tokens",
    props: { s: { type: "string", value: "s" }, on: { type: "boolean", value: true } },
    render: (b) =>
      b.el(
        "p",
        [b.bind("title", "s +\u3000s")],
        b.i("s\u2003+ s"),
        b.i("s +\ufeffs"),
        b.if(["on\u2028&& s", b.el("b", [], "on")]),
      ),
    expected: '<p title="ss">ssss<b>on</b></p>',
  },

  // Conditionals (ADR-0036): truthiness, chains, empty branches, branches that are not one element.
  {
    name: "falsy values that are not booleans render nothing",
    props: {
      zero: { type: "number", value: 0 },
      empty: { type: "string", value: "" },
      nan: { type: "number", value: Number.NaN },
    },
    render: (b) =>
      b.el(
        "p",
        [],
        b.if(["zero", b.el("b", [], "zero")]),
        b.if(["empty", b.el("i", [], "empty")]),
        b.if(["nan", b.el("u", [], "nan")]),
        "|",
      ),
    expected: "<p>|</p>",
  },
  ...[1, 2, 3].map((n): MarkupCase => ({
    name: `an else-if chain with an empty middle branch (${n})`,
    props: { n: { type: "number", value: n } },
    render: (b) =>
      b.el(
        "div",
        [],
        b.if(["n === 1", b.el("b", [], "one")], ["n === 2"], [undefined, b.el("i", [], "other")]),
      ),
    expected: ["<div><b>one</b></div>", "<div></div>", "<div><i>other</i></div>"][n - 1]!,
  })),
  ...[1, 2].map((n): MarkupCase => ({
    name: `a leading empty branch (${n})`,
    props: { n: { type: "number", value: n } },
    render: (b) => b.el("div", [], b.if(["n === 1"], ["n === 2 || n === 3", b.el("b", [], "two")])),
    expected: ["<div></div>", "<div><b>two</b></div>"][n - 1]!,
  })),
  ...[true, false].map((on): MarkupCase => ({
    name: `multi-node and text branches at an element's edges (${on})`,
    props: { on: { type: "boolean", value: on } },
    render: (b) => b.el("p", [], b.if(["on", "a ", b.el("b", [], "b")], [undefined, "plain"])),
    expected: on ? "<p>a <b>b</b></p>" : "<p>plain</p>",
  })),
  ...[true, false].map((on): MarkupCase => ({
    name: `text beside a conditional (${on})`,
    props: { on: { type: "boolean", value: on } },
    render: (b) => b.el("p", [], "x ", b.if(["on", b.el("b", [], "y")]), " z"),
    expected: on ? "<p>x <b>y</b> z</p>" : "<p>x  z</p>",
  })),
  ...[true, false].map((on): MarkupCase => ({
    name: `a conditional nested in a branch, and an interpolation branch (${on})`,
    props: {
      a: { type: "boolean", value: true },
      on: { type: "boolean", value: on },
      s: { type: "string", value: "s" },
    },
    render: (b) =>
      b.el(
        "div",
        [],
        b.if(["a", b.if(["on", b.el("i", [], "ab")], [undefined, b.el("i", [], "a")])]),
        b.if(["on", b.i("s")]),
      ),
    expected: on ? "<div><i>ab</i>s</div>" : "<div><i>a</i></div>",
  })),
  ...[true, false].map((on): MarkupCase => ({
    name: `a whitespace branch between texts (${on})`,
    props: { on: { type: "boolean", value: on } },
    render: (b) => b.el("p", [], "a", b.if(["on", " "]), "b"),
    expected: on ? "<p>a b</p>" : "<p>ab</p>",
  })),
  {
    name: "block-level siblings around a conditional",
    props: { on: { type: "boolean", value: true } },
    render: (b) =>
      b.el(
        "section",
        [],
        b.el("h2", [], "Title"),
        b.if(["on", b.el("p", [], "a"), b.el("p", [], "b")], [undefined, b.el("p", [], "c")]),
        b.el("footer", [], "End"),
      ),
    expected: "<section><h2>Title</h2><p>a</p><p>b</p><footer>End</footer></section>",
  },
  {
    name: "a condition that needs parentheses",
    props: { a: { type: "number | undefined" }, b: { type: "number", value: 2 } },
    render: (b) =>
      b.el(
        "p",
        [],
        b.if(["a ?? b", b.el("b", [], "set")]),
        b.if(["a || b ? a : b", "x"], ["a ?? b", "y"]),
      ),
    expected: "<p><b>set</b>y</p>",
  },

  // Lists (ADR-0036): content and order, keyed, indexed, empty, nested.
  {
    name: "a keyed list of objects",
    props: {
      items: { type: "{ id: string; label: string }[]", value: [item("a", "A"), item("b", "B")] },
    },
    render: (b) =>
      b.el(
        "ul",
        [],
        b.for("items", "item", undefined, "item.id", () => b.el("li", [], b.i("item.label"))),
      ),
    expected: "<ul><li>A</li><li>B</li></ul>",
  },
  {
    name: "an indexed list",
    props: { xs: { type: "string[]", value: ["x", "y"] } },
    render: (b) =>
      b.el(
        "ol",
        [],
        b.for("xs", "x", "i", "i", () => b.el("li", [], b.i("i"), ": ", b.i("x"))),
      ),
    expected: "<ol><li>0: x</li><li>1: y</li></ol>",
  },
  {
    name: "an index read only by the key",
    props: { xs: { type: "string[]", value: ["x", "y"] } },
    render: (b) =>
      b.el(
        "ol",
        [],
        b.for("xs", "x", "i", "`${i}-${x}`", () => b.el("li", [], b.i("x"))),
      ),
    expected: "<ol><li>x</li><li>y</li></ol>",
  },
  {
    name: "an empty list beside a conditional",
    props: { xs: { type: "string[]", value: [] } },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el(
          "ul",
          [],
          b.for("xs", "x", undefined, "x", () => b.el("li", [], b.i("x"))),
        ),
        b.if(["xs.length === 0", b.el("p", [], "Nothing here.")]),
      ),
    expected: "<div><ul></ul><p>Nothing here.</p></div>",
  },
  {
    name: "nested lists, and a conditional in a list",
    props: {
      groups: {
        type: "{ name: string; items: { id: string; label: string; on: boolean }[] }[]",
        value: [
          { name: "g1", items: [item("a", "A"), item("b", "B", false)] },
          { name: "g2", items: [] },
        ],
      },
    },
    render: (b) =>
      b.el(
        "div",
        [],
        b.for("groups", "group", undefined, "group.name", () =>
          b.el(
            "section",
            [],
            b.el("h2", [], b.i("group.name")),
            b.el(
              "ul",
              [],
              b.for("group.items", "entry", "index", "entry.id", () =>
                b.el("li", [], b.i("index"), b.if(["entry.on", " on"], [undefined, " off"])),
              ),
            ),
          ),
        ),
      ),
    expected:
      "<div><section><h2>g1</h2><ul><li>0 on</li><li>1 off</li></ul></section><section><h2>g2</h2><ul></ul></section></div>",
  },
  {
    name: "a list beside text, over a filtered source",
    props: {
      items: {
        type: "{ id: string; label: string; on: boolean }[]",
        value: [item("a", "A"), item("b", "B", false), item("c", "C")],
      },
    },
    render: (b) =>
      b.el(
        "p",
        [],
        "[",
        b.for("items.filter((each) => each.on)", "entry", undefined, "entry.id", () =>
          b.el("b", [], b.i("entry.label")),
        ),
        "]",
      ),
    expected: "<p>[<b>A</b><b>C</b>]</p>",
  },
  {
    name: "a list source that needs parentheses",
    props: { xs: { type: "string[] | undefined" } },
    render: (b) =>
      b.el(
        "ul",
        [],
        b.for("xs ?? []", "x", undefined, "x", () => b.el("li", [], b.i("x"))),
      ),
    expected: "<ul></ul>",
  },

  // Bound attributes (ADR-0037).
  {
    name: "strings, numbers, nullish and empty values",
    props: {
      s: { type: "string", value: `t&"<'` },
      n: { type: "number", value: 0 },
      none: { type: "string | null", value: null },
      empty: { type: "string", value: "" },
      absent: { type: "string" },
    },
    render: (b) =>
      b.el(
        "p",
        [
          b.bind("title", "s"),
          b.bind("data-n", "n"),
          b.bind("id", "none"),
          b.bind("lang", "empty"),
          b.bind("dir", "absent"),
        ],
        "x",
      ),
    expected: `<p title="t&amp;&quot;&lt;'" data-n="0" lang="">x</p>`,
  },
  ...[true, false].map((on): MarkupCase => ({
    name: `bindable boolean attributes (${on})`,
    props: { on: { type: "boolean", value: on }, absent: { type: "boolean" } },
    render: (b) =>
      b.el(
        "form",
        [],
        b.el("input", [
          b.attr("name", "a"),
          b.bind("disabled", "on"),
          b.bind("required", "!on"),
          b.bind("readonly", "absent"),
        ]),
        b.el("select", [b.attr("name", "b"), b.bind("multiple", "on")], b.el("option", [], "a")),
        b.el("img", [b.attr("src", "/a.png"), b.attr("alt", "A"), b.bind("ismap", "on")]),
        b.el("details", [b.bind("open", "on")], b.el("summary", [], "S")),
      ),
    expected: on
      ? `<form><input name="a" disabled><select name="b" multiple><option>a</option></select><img src="/a.png" alt="A" ismap><details open><summary>S</summary></details></form>`
      : `<form><input name="a" required><select name="b"><option>a</option></select><img src="/a.png" alt="A"><details><summary>S</summary></details></form>`,
  })),
  {
    name: "ARIA and enumerated attributes with booleans",
    props: { on: { type: "boolean", value: true }, off: { type: "boolean", value: false } },
    render: (b) =>
      b.el(
        "div",
        [
          b.bind("aria-hidden", "on"),
          b.bind("aria-busy", "off"),
          b.bind("draggable", "on"),
          b.bind("spellcheck", "off"),
          b.bind("contenteditable", "off"),
        ],
        "x",
      ),
    expected: `<div aria-hidden="true" aria-busy="false" draggable="true" spellcheck="false" contenteditable="false">x</div>`,
  },
  {
    name: "a bound value that needs parentheses",
    props: {
      a: { type: "boolean | undefined", value: false },
      b: { type: "boolean", value: true },
    },
    render: (b) =>
      b.el(
        "p",
        [],
        b.el("input", [b.attr("name", "x"), b.bind("disabled", "a ? a : b")]),
        b.el("input", [b.attr("name", "y"), b.bind("disabled", "a ?? b")]),
      ),
    expected: `<p><input name="x" disabled><input name="y"></p>`,
  },

  // Class (ADR-0038): the union of static names, true toggles and dynamic tokens.
  {
    name: "a dynamic class beside a static one",
    props: { tone: { type: "string", value: "b  c" } },
    render: (b) => b.el("p", [b.cls("a", { code: "tone" })], "x"),
    expected: `<p class="a b c">x</p>`,
  },
  {
    name: "toggles, with names that are not identifiers",
    props: { on: { type: "boolean", value: true }, off: { type: "boolean", value: false } },
    render: (b) =>
      b.el("p", [b.cls(["on", "on"], ["off", "off"], ["w-1.5", "on"], ["is:x", "!off"])], "x"),
    expected: `<p class="on w-1.5 is:x">x</p>`,
  },
  {
    name: "toggles that are all false",
    props: { off: { type: "boolean", value: false }, zero: { type: "number", value: 0 } },
    render: (b) => b.el("p", [b.cls(["a", "off"], ["b", "zero"])], "x"),
    expected: "<p>x</p>",
  },
  {
    name: "a nullish or empty dynamic class",
    props: { absent: { type: "string" }, empty: { type: "string", value: "" } },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el("p", [b.cls({ code: "absent" })], "x"),
        b.el("p", [b.cls("a", { code: "empty" }, { code: "absent" })], "y"),
      ),
    expected: `<div><p>x</p><p class="a">y</p></div>`,
  },
  {
    name: "static, dynamic and toggled parts together",
    props: {
      tone: { type: "string", value: "warn" },
      on: { type: "boolean", value: true },
      n: { type: "number", value: 0 },
    },
    render: (b) =>
      b.el(
        "p",
        [
          b.cls("badge", { code: "tone" }, ["active", "on"], ["zero", "n"], {
            code: "on ? 'x y' : 'z'",
          }),
        ],
        "x",
      ),
    expected: `<p class="badge warn active x y">x</p>`,
  },
  {
    name: "a spread whose class key merges with the element's class",
    props: {
      attrs: {
        type: "{ id?: string; class?: string; title?: string }",
        value: { id: "i", class: "x y", title: "t" },
      },
    },
    render: (b) =>
      b.el("p", [b.attr("class", "base"), b.spread("attrs", "id", "class", "title")], "x"),
    expected: `<p class="base x y" id="i" title="t">x</p>`,
  },
  {
    name: "an optional spread, absent",
    props: { attrs: { type: '{ id?: string; class?: string; "data-x"?: string } | undefined' } },
    render: (b) =>
      b.el("p", [b.cls("base", ["on", "true"]), b.spread("attrs", "id", "class", "data-x")], "x"),
    expected: `<p class="base on">x</p>`,
  },
  // Every source that may be nullish reads its keys through `?.`, not only an optional prop: a
  // `null`, an optional member, a conditional and a list's item (the spread's `nullish`).
  {
    name: "spreads of nullish sources: null, an absent member and a conditional",
    props: {
      empty: { type: '{ id?: string; "data-x"?: string } | null', value: null },
      box: { type: "{ inner?: { id?: string; class?: string } }", value: {} },
      on: { type: "boolean", value: false },
      attrs: { type: "{ id?: string; class?: string }", value: { id: "i", class: "c" } },
    },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el("p", [b.spread("empty", "id", "data-x")], "a"),
        b.el(
          "p",
          [b.attr("class", "base"), b.spread({ code: "box.inner", nullish: true }, "id", "class")],
          "b",
        ),
        b.el(
          "p",
          [b.spread({ code: "on ? attrs : undefined", nullish: true }, "id", "class")],
          "c",
        ),
        b.el(
          "p",
          [b.spread({ code: "on ? undefined : attrs", nullish: true }, "id", "class")],
          "d",
        ),
      ),
    expected: `<div><p>a</p><p class="base">b</p><p>c</p><p id="i" class="c">d</p></div>`,
  },
  {
    name: "a spread of list items that may be absent",
    props: {
      rows: {
        type: "({ id?: string; class?: string } | undefined)[]",
        value: [undefined, { id: "r", class: "c" }],
      },
    },
    render: (b) =>
      b.el(
        "ul",
        [],
        b.for("rows", "row", "i", "i", () =>
          b.el(
            "li",
            [b.attr("class", "row"), b.spread({ code: "row", nullish: true }, "id", "class")],
            "x",
          ),
        ),
      ),
    expected: `<ul><li class="row">x</li><li class="row c" id="r">x</li></ul>`,
  },
  {
    name: "a spread with keys that are not identifiers, and a boolean key",
    props: {
      attrs: {
        type: '{ "data-x"?: string; "aria-label"?: string; disabled?: boolean }',
        value: { "data-x": "1", "aria-label": "L", disabled: false },
      },
    },
    render: (b) =>
      b.el(
        "button",
        [b.attr("type", "button"), b.spread("attrs", "data-x", "aria-label", "disabled")],
        "x",
      ),
    expected: `<button type="button" data-x="1" aria-label="L">x</button>`,
  },

  // Style (ADR-0038): present declarations in any order, none when none are present.
  {
    name: "a static style",
    props: {},
    render: (b) => b.el("p", [b.style(["color", "red"], ["margin-top", "4px"])], "x"),
    expected: `<p style="color: red; margin-top: 4px">x</p>`,
  },
  {
    name: "bound declarations, custom properties and unitless numbers",
    props: {
      color: { type: "string", value: "blue" },
      gap: { type: "string", value: "2px" },
      z: { type: "number", value: 2 },
    },
    render: (b) =>
      b.el(
        "p",
        [
          b.style(
            ["color", { code: "color" }],
            ["margin-top", { code: "gap" }],
            ["--gap", { code: "gap" }],
            ["z-index", { code: "z" }],
            ["line-height", { code: "1.5" }],
          ),
        ],
        "x",
      ),
    expected: `<p style="color: blue; margin-top: 2px; --gap: 2px; z-index: 2; line-height: 1.5">x</p>`,
  },
  {
    name: "nullish and empty declarations are left out",
    props: { absent: { type: "string" }, empty: { type: "string", value: "" } },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el("p", [b.style(["color", { code: "absent" }], ["margin-top", { code: "empty" }])], "x"),
        b.el("p", [b.style(["color", "red"], ["margin-top", { code: "absent" }])], "y"),
      ),
    expected: `<div><p>x</p><p style="color: red">y</p></div>`,
  },
  {
    name: "a bound declaration before a static one",
    props: { gap: { type: "string", value: "1px" } },
    render: (b) => b.el("p", [b.style(["margin", { code: "gap" }], ["color", "red"])], "x"),
    expected: `<p style="margin: 1px; color: red">x</p>`,
  },

  {
    name: "a static class name and a static style value that hold a template's delimiters",
    props: { tone: { type: "string", value: "t" } },
    render: (b) =>
      b.el(
        "p",
        [
          b.cls("{{a}}", "@b", { code: "tone" }),
          b.style(["content", '"{{ x }} {y} @if"'], ["color", "red"]),
        ],
        "x",
      ),
    expected: `<p class="{{a}} @b t" style="content: &quot;{{ x }} {y} @if&quot;; color: red">x</p>`,
  },
  {
    // Vue's compiler parses a static `style` again, knowing no strings: it splits at a `;` in
    // one, not before a value whose first parenthesis is a `)`, and it removes comments. Its
    // dialect binds such a value instead (Angular reads each of these as written).
    name: "static style values that Vue's style parser misreads",
    props: { c: { type: "string", value: "blue" } },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el("p", [b.style(["font-family", '"A;B", serif'], ["color", "red"])], "a"),
        b.el("p", [b.style(["margin", "0"], ["content", '")" "("'])], "b"),
        b.el("p", [b.style(["content", "'x;y'"], ["margin", "1px/**/2px"])], "c"),
        b.el("p", [b.style(["font-family", '"C;D", serif'], ["color", { code: "c" }])], "d"),
      ),
    expected: [
      "<div>",
      '<p style="font-family: &quot;A;B&quot;, serif; color: red">a</p>',
      '<p style="margin: 0; content: &quot;)&quot; &quot;(&quot;">b</p>',
      `<p style="content: 'x;y'; margin: 1px/**/2px">c</p>`,
      '<p style="font-family: &quot;C;D&quot;, serif; color: blue">d</p>',
      "</div>",
    ].join(""),
  },

  // SVG (ADR-0040).
  {
    name: "an icon, with self-closing children, a title and a list",
    props: {
      label: { type: "string", value: "Icon" },
      xs: { type: "number[]", value: [1, 3] },
      r: { type: "number", value: 4 },
    },
    render: (b) =>
      b.el(
        "div",
        [],
        b.el(
          "svg",
          [
            b.attr("viewBox", "0 0 24 24"),
            b.attr("role", "img"),
            b.attr("aria-labelledby", "icon-title"),
          ],
          b.el("title", [b.attr("id", "icon-title")], b.i("label")),
          b.el("circle", [
            b.attr("cx", "12"),
            b.attr("cy", "12"),
            b.bind("r", "r"),
            b.attr("stroke-width", "2"),
          ]),
          b.el(
            "g",
            [],
            b.for("xs", "x", undefined, "x", () =>
              b.el("rect", [
                b.bind("x", "x"),
                b.attr("y", "0"),
                b.attr("width", "1"),
                b.attr("height", "1"),
              ]),
            ),
          ),
          b.el("linearGradient", [b.attr("id", "g")], b.el("stop", [b.attr("offset", "0")])),
        ),
      ),
    expected: `<div><svg viewBox="0 0 24 24" role="img" aria-labelledby="icon-title"><title id="icon-title">Icon</title><circle cx="12" cy="12" r="4" stroke-width="2"/><g><rect x="1" y="0" width="1" height="1"/><rect x="3" y="0" width="1" height="1"/></g><linearGradient id="g"><stop offset="0"/></linearGradient></svg></div>`,
  },

  // Text inside `<pre>`, beside control flow.
  ...[true, false].map((on): MarkupCase => ({
    name: `whitespace in a pre, around a conditional (${on})`,
    props: { on: { type: "boolean", value: on }, s: { type: "string", value: "s" } },
    render: (b) => b.el("pre", [], "a  ", b.if(["on", " b\n"], [undefined, b.i("s")]), "\tc "),
    expected: on ? "<pre>a   b\n\tc </pre>" : "<pre>a  s\tc </pre>",
  })),
];

/** Cases whose tree is a component's root: a fragment, whose edges a target pads. */
export const ROOT_CASES: readonly MarkupCase[] = [
  {
    name: "a root fragment with text and interpolations at its edges",
    props: { s: { type: "string", value: "S" } },
    render: (b) =>
      b.fragment("a ", b.el("b", [], "b"), b.i("s"), " ", b.el("i", [], "c"), b.i("s"), " z"),
    expected: "a <b>b</b>S <i>c</i>S z",
  },
  {
    name: "a root fragment that starts and ends with interpolations",
    props: { s: { type: "string", value: "S" } },
    render: (b) => b.fragment(b.i("s"), b.el("p", [], "x"), b.i("s")),
    expected: "S<p>x</p>S",
  },
  {
    name: "a root fragment of blocks",
    props: { on: { type: "boolean", value: true }, xs: { type: "string[]", value: ["x", "y"] } },
    render: (b) =>
      b.fragment(
        b.if(["on", b.el("h1", [], "T")]),
        b.el(
          "ul",
          [],
          b.for("xs", "x", undefined, "x", () => b.el("li", [], b.i("x"))),
        ),
        b.el("p", [], "end"),
      ),
    expected: "<h1>T</h1><ul><li>x</li><li>y</li></ul><p>end</p>",
  },
];
