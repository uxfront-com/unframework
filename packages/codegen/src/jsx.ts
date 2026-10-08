// The JSX printer (plan §5.8): IR render trees as JSX ASTs, for React, Solid and Qwik. The
// defaults print React-style JSX (ternary chains with `null`, `.map` with keys, `{expr}`,
// `name={expr}`, `onClick={handler}`, `ref={input}`); a dialect overrides what its framework
// writes differently. Expressions and handlers enter the AST as placeholders that
// `printComponentModule` (or `Placeholders.print`) splices with their source text, so
// literals, spacing and comments stay as the author wrote them.
import type * as AST from "@oxc-project/types";
import type {
  Binding,
  BindingId,
  BoundAttribute,
  ClassAttribute,
  ElementNode,
  EventAttribute,
  Expression,
  ForNode,
  FragmentNode,
  Handler,
  IfNode,
  RefAttribute,
  RenderNode,
  SpreadAttribute,
  SpreadKey,
  StaticAttribute,
  StyleAttribute,
  UfComponent,
} from "@unframework/ir";

import { handlerText } from "./functions.ts";
import * as js from "./js/builders.ts";
import { Placeholders } from "./js/placeholders.ts";
import { referencedBindings } from "./references.ts";
import { bindingOf, rewriteExpression } from "./rewrite.ts";
import type { ParenthesesSlot, RewriteRules, RewriteSite } from "./rewrite.ts";

/**
 * How a JSX target writes what its framework writes differently from the defaults. Each hook
 * gets the context, so it can print nested nodes and expressions with the same machinery
 * ({@link jsxNode}, {@link jsxChildren}, {@link jsxExpression}).
 */
export interface JsxDialect {
  /**
   * The attribute name the framework expects (React: `class` → `className`), which may depend
   * on the element's other attributes (an input's `type`).
   */
  attributeName?(name: string, element: ElementNode): string;
  /**
   * The value to write for an attribute given without one in the source
   * (`<input disabled />`). `true` writes it bare; a string writes that value.
   */
  presentAttributeValue?(name: string, element: ElementNode): true | string;
  /**
   * The code an expression prints as, for `site` (`render`, or `key` for a list's key). By
   * default its source text, with each reference spelled by the context's rewrite rules.
   */
  expression?(expression: Expression, context: JsxContext, site: RewriteSite): string;
  /** A conditional: by default a ternary chain ending in `null` ({@link ternaryChain}). */
  conditional?(node: IfNode, context: JsxContext): AST.Expression;
  /** A list: by default `source.map((item, index) => <el key={…}>…</el>)` ({@link mapCall}). */
  list?(node: ForNode, context: JsxContext): AST.Expression;
  /** A static attribute: by default {@link staticJsxAttribute}. */
  staticAttribute?(
    attribute: StaticAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
  /** A bound attribute: by default `name={expr}`. */
  boundAttribute?(
    attribute: BoundAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
  /** A `class` built from parts: by default `class={["a", tone, { on: active }]}`. */
  classAttribute?(
    attribute: ClassAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
  /** A `style`: by default `style={{ color: "red", marginTop: gap }}` (camelCase keys). */
  styleAttribute?(
    attribute: StyleAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
  /**
   * A spread with known keys: by default one attribute per declared key, `title={attrs.title}`,
   * with a `class` key merged into the element's `class`.
   */
  spreadAttribute?(
    attribute: SpreadAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
  /**
   * A listener: by default `onClick={handler}` (see {@link eventJsxAttribute}). The event's name
   * is the framework's (React's `onKeyDown`, Qwik's `onKeyDown$`), so a target writes its own.
   */
  eventAttribute?(
    attribute: EventAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
  /** A template ref: by default `ref={input}`, the binding by its name. */
  refAttribute?(
    attribute: RefAttribute,
    element: ElementNode,
    context: JsxContext,
  ): AST.JSXAttributeItem[];
}

/** What a JSX printer prints one component with. */
export interface JsxContext {
  readonly component: UfComponent;
  readonly dialect: JsxDialect;
  /** How references are spelled: as written when absent. */
  readonly rules: RewriteRules | undefined;
  /** Where expressions go until the module is printed. */
  readonly placeholders: Placeholders;
  /**
   * The bindings the printed code references, handlers included: a list's index parameter
   * outside it is left out (an unused parameter fails L5).
   */
  readonly referenced: ReadonlySet<BindingId>;
}

/** The options of {@link jsxContext}. */
export interface JsxContextOptions {
  component: UfComponent;
  dialect?: JsxDialect;
  rules?: RewriteRules;
  placeholders?: Placeholders;
  /** Whether lists' keys count as printed references: `false` for a target without keys. */
  includeKeys?: boolean;
  /**
   * Whether handlers and the setup's client code count as printed references: `false` for a
   * target that prints none (see `referencedBindings`). Default `true`.
   */
  includeClient?: boolean;
}

/** The context to print a component's JSX with. */
export function jsxContext(options: JsxContextOptions): JsxContext {
  return {
    component: options.component,
    dialect: options.dialect ?? {},
    rules: options.rules,
    placeholders: options.placeholders ?? new Placeholders(),
    referenced: referencedBindings(options.component, {
      ...(options.includeKeys === undefined ? {} : { includeKeys: options.includeKeys }),
      ...(options.includeClient === undefined ? {} : { includeClient: options.includeClient }),
    }),
  };
}

/** The binding a component declares under `id`. */
export function jsxBinding(id: BindingId, context: JsxContext): Binding {
  return bindingOf(context.component, id);
}

/**
 * The code an expression prints as, for `site` (`render` by default): the dialect's, or its
 * source with references rewritten.
 */
export function expressionCode(
  expression: Expression,
  context: JsxContext,
  site: RewriteSite = "render",
): string {
  if (context.dialect.expression) return context.dialect.expression(expression, context, site);
  return context.rules
    ? rewriteExpression(expression, context.component, context.rules, site)
    : expression.code;
}

/**
 * An expression in the AST: a placeholder for its code, parenthesised when `slot` needs it
 * (`argument`, the default, takes any expression). Each call makes a new placeholder, to be
 * printed once.
 */
export function jsxExpression(
  expression: Expression,
  context: JsxContext,
  slot: ParenthesesSlot = "argument",
  site: RewriteSite = "render",
): AST.Expression {
  return context.placeholders.expression(expressionCode(expression, context, site), slot);
}

/**
 * A node in expression position: the root (`return <div>…</div>`), a conditional's branch or
 * a list's body. Text is a string literal there, and an interpolation its expression.
 */
export function jsxNode(node: RenderNode | FragmentNode, context: JsxContext): AST.Expression {
  const { dialect } = context;
  switch (node.kind) {
    case "Element":
      return jsxElement(node, context);
    case "Fragment":
      return js.jsxFragment(jsxChildren(node.children, context));
    case "Text":
      return js.stringLiteral(node.value);
    case "Interpolation":
      return jsxExpression(node.value, context);
    case "If":
      return dialect.conditional ? dialect.conditional(node, context) : ternaryChain(node, context);
    case "For":
      return dialect.list ? dialect.list(node, context) : mapCall(node, context);
    // Composition (ADR-0055) is not printed yet: each target's `emit` reports UF1002 for it
    // before printing (`compositionUse`), until M3's lanes print it.
    case "Component":
    case "SlotOutlet":
    case "Dynamic":
      return js.nullLiteral();
    default:
      return unreachable(node);
  }
}

/**
 * Nodes in child position: elements as they are, text as JSX text (see {@link jsxText}), and
 * everything else in `{…}`, unless a dialect printed it as an element (Solid's `<Show>`).
 */
export function jsxChildren(nodes: readonly RenderNode[], context: JsxContext): AST.JSXChild[] {
  return nodes.map((node): AST.JSXChild => {
    switch (node.kind) {
      case "Element":
        return jsxElement(node, context);
      case "Text":
        return jsxText(node.value);
      case "Interpolation":
      case "If":
      case "For": {
        const expression = jsxNode(node, context);
        return expression.type === "JSXElement" || expression.type === "JSXFragment"
          ? expression
          : js.jsxExpressionContainer(expression);
      }
      // Not printed yet (`jsxNode`).
      case "Component":
      case "SlotOutlet":
      case "Dynamic":
        return js.jsxExpressionContainer(js.nullLiteral());
      default:
        return unreachable(node);
    }
  });
}

/**
 * What a conditional's branch renders, in expression position: `null` for nothing, the node
 * itself for one, and a fragment for several.
 */
export function jsxBranch(children: readonly RenderNode[], context: JsxContext): AST.Expression {
  const [only] = children;
  if (!only) return js.nullLiteral();
  if (children.length === 1) return jsxNode(only, context);
  return js.jsxFragment(jsxChildren(children, context));
}

/**
 * A conditional as a ternary chain, `a ? <A /> : b ? <B /> : null`: the else branch, or
 * `null`, ends it. Never `&&`: `0 && <A />` renders `0`, where the IR's truthiness test renders
 * nothing (ADR-0036).
 */
export function ternaryChain(node: IfNode, context: JsxContext): AST.Expression {
  const branches = [...node.branches];
  const last = branches.at(-1);
  let chain: AST.Expression = js.nullLiteral();
  if (last && !last.condition) {
    chain = jsxBranch(last.children, context);
    branches.pop();
  }
  for (const branch of branches.toReversed()) {
    chain = js.conditionalExpression(
      jsxExpression(branch.condition!, context, "test"),
      jsxBranch(branch.children, context),
      chain,
    );
  }
  return chain;
}

/**
 * A list as `source.map((item, index) => <el key={key}>…</el>)`, the key first on the body.
 * The index parameter is left out when nothing printed reads it.
 */
export function mapCall(node: ForNode, context: JsxContext): AST.Expression {
  const key = js.jsxAttribute(
    "key",
    js.jsxExpressionContainer(jsxExpression(node.key, context, "argument", "key")),
  );
  // A component as the body is not printed yet (`jsxNode`).
  const body =
    node.body.kind === "Element" ? jsxElement(node.body, context, [key]) : js.nullLiteral();
  return js.callExpression(
    js.memberExpression(jsxExpression(node.source, context, "operand"), "map"),
    [js.arrowFunction(listParameters(node, context), body)],
  );
}

/**
 * A list callback's parameters: the item, and the index when a printed expression reads it.
 */
export function listParameters(node: ForNode, context: JsxContext): AST.BindingIdentifier[] {
  const item = jsxBinding(node.item, context);
  const index = node.index === undefined ? undefined : jsxBinding(node.index, context);
  const parameters = [js.bindingIdentifier(item.name)];
  if (index && context.referenced.has(index.id)) parameters.push(js.bindingIdentifier(index.name));
  return parameters;
}

/**
 * An element, self-closing when it has no children; `leading` attributes (a list body's
 * `key`) come first.
 */
export function jsxElement(
  node: ElementNode,
  context: JsxContext,
  leading: readonly AST.JSXAttributeItem[] = [],
): AST.JSXElement {
  return js.jsxElement(
    node.tag,
    [...leading, ...jsxAttributes(node, context)],
    jsxChildren(node.children, context),
  );
}

/** An element's attributes, in source order, each through its dialect hook. */
export function jsxAttributes(node: ElementNode, context: JsxContext): AST.JSXAttributeItem[] {
  const { dialect } = context;
  return node.attributes.flatMap((attribute) => {
    switch (attribute.kind) {
      case "Static":
        return dialect.staticAttribute
          ? dialect.staticAttribute(attribute, node, context)
          : staticJsxAttribute(attribute, node, context);
      case "Bound":
        return dialect.boundAttribute
          ? dialect.boundAttribute(attribute, node, context)
          : boundJsxAttribute(attribute, node, context);
      case "Class":
        return dialect.classAttribute
          ? dialect.classAttribute(attribute, node, context)
          : classJsxAttribute(attribute, node, context);
      case "Style":
        return dialect.styleAttribute
          ? dialect.styleAttribute(attribute, node, context)
          : styleJsxAttribute(attribute, node, context);
      case "Spread":
        return dialect.spreadAttribute
          ? dialect.spreadAttribute(attribute, node, context)
          : spreadJsxAttributes(attribute, node, context);
      case "Event":
        return dialect.eventAttribute
          ? dialect.eventAttribute(attribute, node, context)
          : eventJsxAttribute(attribute, node, context);
      case "Ref":
        return dialect.refAttribute
          ? dialect.refAttribute(attribute, node, context)
          : refJsxAttribute(attribute, node, context);
      // Not printed yet (`jsxNode`).
      case "Model":
        return [];
      default:
        return unreachable(attribute);
    }
  });
}

/** The attribute name a dialect writes. */
export function jsxAttributeName(name: string, element: ElementNode, context: JsxContext): string {
  return context.dialect.attributeName?.(name, element) ?? name;
}

/**
 * A static attribute: `name="value"` or `{"value"}` (see {@link jsxAttributeValue}), or bare
 * as the dialect's `presentAttributeValue` says. A static `class` beside a spread that carries
 * `class` merges with it: `class={["a b", attrs.class]}`.
 */
export function staticJsxAttribute(
  attribute: StaticAttribute,
  element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  const name = jsxAttributeName(attribute.name, element, context);
  if (attribute.name === "class" && typeof attribute.value === "string") {
    const reads = spreadClassReads(element, context);
    if (reads.length) {
      const items = [js.stringLiteral(attribute.value), ...reads];
      return [js.jsxAttribute(name, js.jsxExpressionContainer(js.arrayExpression(items)))];
    }
  }
  const value =
    attribute.value === true
      ? (context.dialect.presentAttributeValue?.(attribute.name, element) ?? true)
      : attribute.value;
  return [js.jsxAttribute(name, value === true ? null : jsxAttributeValue(value))];
}

/** A bound attribute, `name={expr}`. */
export function boundJsxAttribute(
  attribute: BoundAttribute,
  element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  const value = js.jsxExpressionContainer(jsxExpression(attribute.value, context));
  return [js.jsxAttribute(jsxAttributeName(attribute.name, element, context), value)];
}

/**
 * A `class` from parts as an array (Qwik's and Vue's form): static names as strings, dynamic
 * parts as written, adjacent toggles as one object, and the class of each spread after them.
 */
export function classJsxAttribute(
  attribute: ClassAttribute,
  element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  const items = [...classArrayItems(attribute, context), ...spreadClassReads(element, context)];
  return [
    js.jsxAttribute(
      jsxAttributeName("class", element, context),
      js.jsxExpressionContainer(js.arrayExpression(items)),
    ),
  ];
}

/**
 * The parts of a `class` as array items: `"a b"` for static names, the expression for a
 * dynamic part, and `{ name: condition }` for toggles, adjacent ones in one object.
 */
export function classArrayItems(attribute: ClassAttribute, context: JsxContext): AST.Expression[] {
  const items: AST.Expression[] = [];
  let toggles: AST.ObjectExpression | undefined;
  for (const item of attribute.items) {
    if (item.kind === "Toggle") {
      const entry = js.property(item.name, jsxExpression(item.condition, context));
      if (toggles) toggles.properties.push(entry);
      else items.push((toggles = js.objectExpression([entry])));
      continue;
    }
    toggles = undefined;
    items.push(
      item.kind === "Static" ? js.stringLiteral(item.value) : jsxExpression(item.value, context),
    );
  }
  return items;
}

/** A `style` as an object with camelCase keys (React's and Qwik's form). */
export function styleJsxAttribute(
  attribute: StyleAttribute,
  element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  return [
    js.jsxAttribute(
      jsxAttributeName("style", element, context),
      js.jsxExpressionContainer(styleObject(attribute, context, "camel")),
    ),
  ];
}

/**
 * A `style`'s declarations as an object literal, in source order: static values as strings,
 * bound ones as written. Keys are camelCase (`marginTop`, React and Qwik) or kebab-case
 * (`"margin-top"`, Solid); custom properties keep their name (`"--gap"`).
 */
export function styleObject(
  attribute: StyleAttribute,
  context: JsxContext,
  keys: "camel" | "kebab",
): AST.ObjectExpression {
  return js.objectExpression(
    attribute.declarations.map((declaration) => [
      styleKey(declaration.property, keys),
      declaration.kind === "Static"
        ? js.stringLiteral(declaration.value)
        : jsxExpression(declaration.value, context),
    ]),
  );
}

/**
 * A CSS property as a style object's key: kebab-case as the IR holds it, or camelCase with
 * React's vendor spellings (`-webkit-x` → `WebkitX`, `-ms-x` → `msX`). Custom properties
 * never change.
 */
export function styleKey(property: string, keys: "camel" | "kebab"): string {
  if (keys === "kebab" || property.startsWith("--")) return property;
  return property
    .replace(/^-ms-/, "ms-")
    .replace(/^-/, "")
    .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    .replace(/^(webkit|moz|o)(?=[A-Z])/, (prefix) => prefix[0]!.toUpperCase() + prefix.slice(1));
}

/**
 * A spread as one attribute per declared key (ADR-0039): `title={attrs.title}`, through `?.`
 * when the source may be nullish. A `class` key is left to the element's own `class`, which
 * merges it, when the element has one.
 */
export function spreadJsxAttributes(
  attribute: SpreadAttribute,
  element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  const merged = hasClass(element);
  return attribute.keys
    .filter((key) => !(merged && key.name === "class"))
    .map((key) =>
      js.jsxAttribute(
        jsxAttributeName(key.name, element, context),
        js.jsxExpressionContainer(spreadRead(attribute, key, context)),
      ),
    );
}

/** Whether an element has a `class` of its own, static or from parts. */
function hasClass(element: ElementNode): boolean {
  return element.attributes.some(
    (attribute) =>
      attribute.kind === "Class" || (attribute.kind === "Static" && attribute.name === "class"),
  );
}

/**
 * The value of one of a spread's keys: `attrs.title`, `attrs["aria-label"]`, or through `?.`
 * when the analyser found that the source may be nullish there (`attrs?.title`,
 * `(on ? attrs : undefined)?.title`), as a spread of nothing renders no key.
 */
export function spreadRead(
  attribute: SpreadAttribute,
  key: SpreadKey,
  context: JsxContext,
): AST.Expression {
  const source = jsxExpression(attribute.value, context, "operand");
  if (!attribute.nullish) return js.memberExpression(source, key.name);
  const read = js.memberExpression(source, key.name, { optional: true });
  return js.chainExpression(read as AST.ChainElement);
}

/**
 * The reads of `class` from the spreads on an element that carry one: what the element's
 * `class` merges (one at most, by ADR-0039's invariant).
 */
export function spreadClassReads(element: ElementNode, context: JsxContext): AST.Expression[] {
  return element.attributes.flatMap((attribute) => {
    if (attribute.kind !== "Spread") return [];
    const key = attribute.keys.find((entry) => entry.name === "class");
    return key ? [spreadRead(attribute, key, context)] : [];
  });
}

/**
 * A listener as React writes one: `on` and the event's name with its first letter in upper case,
 * `Capture` for the capture phase (`onClickCapture`), and the handler ({@link jsxHandler}). The
 * name is the DOM's otherwise (`onKeydown`, where React writes `onKeyDown`): the event table is
 * the target's (P6), which writes its own through `eventAttribute`. JSX has no spelling of its
 * own for `once` or `passive`, so a listener with either throws here: its dialect prints it.
 */
export function eventJsxAttribute(
  attribute: EventAttribute,
  _element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  const option = attribute.once ? "once" : attribute.passive ? "passive" : undefined;
  if (option) {
    throw new Error(
      `JSX has no spelling for a ${option} \`${attribute.event}\` listener: the target's dialect prints it (eventAttribute).`,
    );
  }
  const name = `on${attribute.event.charAt(0).toUpperCase()}${attribute.event.slice(1)}${attribute.capture ? "Capture" : ""}`;
  return [js.jsxAttribute(name, js.jsxExpressionContainer(jsxHandler(attribute.handler, context)))];
}

/**
 * A listener's handler in the AST, for the `client` site: a named handler's function, as the
 * context's rules spell it, or an inline handler as an arrow (`functionText`), each a
 * placeholder.
 */
export function jsxHandler(handler: Handler, context: JsxContext): AST.Expression {
  return context.placeholders.expression(
    handlerText(handler, context.component, context.rules, "client"),
  );
}

/** A template ref, `ref={input}`: the binding by its name, which the target declares. */
export function refJsxAttribute(
  attribute: RefAttribute,
  _element: ElementNode,
  context: JsxContext,
): AST.JSXAttributeItem[] {
  const binding = jsxBinding(attribute.binding, context);
  return [js.jsxAttribute("ref", js.jsxExpressionContainer(js.identifier(binding.name)))];
}

/**
 * What JSX text may hold as written: no `{ }`, which are syntax, no run of spaces, and no
 * whitespace but the plain space by any JSX implementation's definition. That is JavaScript's
 * `\s`, plus what TypeScript and oxc (`isWhiteSpaceSingleLine`) and the Qwik optimizer's SWC
 * (Unicode's `White_Space`) also trim where a line meets a line break: U+0085 and U+200B. Nor
 * `//` or `/*` where a formatter may start a line with them (the text's start, or after a
 * space): lint rules read those as comments put in JSX by mistake.
 */
const UNSAFE_JSX_TEXT = /[{}]|[^\S ]|[\u0085​]| {2}|(?:^| )\/[/*]/;

/**
 * JSX text, with `&`, `<` and `>` written as character references, when the text survives
 * every JSX transform and formatter as written: words separated by single plain spaces.
 * Anything else is a string expression (`{"a  b"}`), so the DOM text is exactly the IR's.
 * JSX treats `{ }` as syntax and trims around line breaks; formatters reflow runs of spaces
 * and may move any word to a line's edge; and the transforms disagree on the rest: Solid's
 * collapses raw tabs and Unicode spaces into one space, oxc trims a zero-width space at a
 * line's edge, and the Qwik optimizer decodes a reference (`&#9;`, `&nbsp;`) before it trims a
 * line's edges, so not even those are safe (ADR-0030).
 */
export function jsxText(value: string): AST.JSXText | AST.JSXExpressionContainer {
  if (!UNSAFE_JSX_TEXT.test(value) && value.trim() !== "") {
    const raw = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return { type: "JSXText", value, raw, start: 0, end: 0 };
  }
  return js.jsxExpressionContainer(js.stringLiteral(value));
}

/**
 * A quoted attribute value, or a string expression when quoting cannot express it: JSX has no
 * escapes in quoted values but decodes character references in them, and the Qwik optimizer
 * turns a raw tab or line break in one into a space.
 */
export function jsxAttributeValue(value: string): AST.JSXAttributeValue {
  if (!/["&]/.test(value) && !/[^\S ]/.test(value)) {
    return { type: "Literal", value, raw: `"${value}"`, start: 0, end: 0 } as AST.StringLiteral;
  }
  return js.jsxExpressionContainer(js.stringLiteral(value));
}

function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
