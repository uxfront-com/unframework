// How Solid writes what its JSX writes differently from the codegen defaults (design §5.4):
// control flow through Solid's own components (`<Show>`, `<Switch>`/`<Match>`, `<For>`), which
// update the DOM in place where a ternary or `.map` would recreate it; `class` as one string;
// and kebab-case style objects. Everything else (elements, text, bound attributes, spreads
// key by key) prints as the defaults do, with HTML attribute names, which Solid's JSX takes.
import {
  classArrayItems,
  js,
  jsxAttributeValue,
  jsxBinding,
  jsxBranch,
  jsxChildren,
  jsxElement,
  jsxExpression,
  parseExpression,
  spreadClassReads,
  staticJsxAttribute,
} from "@unframework/codegen";
import type { ImportSet, JsxContext, JsxDialect } from "@unframework/codegen";
import type {
  ClassAttribute,
  ElementNode,
  Expression,
  ForNode,
  IfBranch,
  IfNode,
  RenderNode,
  StyleAttribute,
  UfComponent,
} from "@unframework/ir";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type AstExpression = Parameters<typeof js.callExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
type JsxChild = ReturnType<typeof jsxChildren>[number];

/** The class helper's name, before the name scope makes it unique. */
export const CLASS_HELPER = "cx";

/** The Solid dialect of one output file, and the helpers its JSX ended up calling. */
export interface SolidJsx {
  dialect: JsxDialect;
  /** The inline helpers to print after the component, as source code. */
  helpers(): string[];
}

/**
 * The Solid dialect for one output file. Imports (`Show`, `For`…) and the class helper's name
 * are claimed from the file's name scope when first used, so they never capture a source name.
 */
export function solidJsx(imports: ImportSet): SolidJsx {
  let helper: string | undefined;
  const classHelper = () => (helper ??= imports.claim(CLASS_HELPER));
  const dialect: JsxDialect = {
    conditional: (node, context) => conditional(node, context, imports),
    list: (node, context) => list(node, context, imports),
    staticAttribute(attribute, element, context) {
      if (attribute.name === "class" && typeof attribute.value === "string") {
        const reads = spreadClassReads(element, context);
        if (reads.length) {
          return [classCall(classHelper(), [js.stringLiteral(attribute.value), ...reads])];
        }
      }
      return staticJsxAttribute(attribute, element, context);
    },
    classAttribute: (attribute, element, context) =>
      classAttribute(attribute, element, context, classHelper),
    styleAttribute: (attribute, element, context) => [styleAttribute(attribute, context)],
  };
  return { dialect, helpers: () => (helper ? [classHelperCode(helper)] : []) };
}

/**
 * A conditional as Solid's control flow, which keeps a branch's DOM while its condition stays
 * truthy. Both test truthiness, as the IR does (ADR-0036: `0` takes the fallback):
 *
 * - one condition: `<Show when={c} fallback={…}>…</Show>`; an empty first branch before an
 *   else shows the else under the negated condition (`c ? null : <B />` → `<Show when={!c}>`);
 * - more: `<Switch fallback={…}><Match when={a}>…</Match><Match when={b}>…</Match></Switch>`,
 *   where an empty branch still stops the chain with `{null}`, as Solid's types require
 *   children (design §5.4).
 */
function conditional(node: IfNode, context: JsxContext, imports: ImportSet): AstExpression {
  const last = node.branches.at(-1)!;
  const tests = last.condition ? node.branches : node.branches.slice(0, -1);
  // The analyser drops an empty else; an empty one here would only print `fallback={null}`.
  const fallback = last.condition || last.children.length === 0 ? undefined : last.children;
  if (tests.length === 1) {
    const [only] = tests as [IfBranch];
    if (only.children.length === 0 && fallback) {
      const negated = js.unaryExpression("!", jsxExpression(only.condition!, context, "operand"));
      return show(negated, fallback, undefined, context, imports);
    }
    return show(jsxExpression(only.condition!, context), only.children, fallback, context, imports);
  }
  const matches = tests.map((branch) =>
    js.jsxElement(
      imports.add("solid-js", "Match"),
      [when(jsxExpression(branch.condition!, context))],
      branchChildren(branch.children, context),
    ),
  );
  return js.jsxElement(
    imports.add("solid-js", "Switch"),
    fallback ? [fallbackAttribute(fallback, context)] : [],
    matches,
  );
}

/** `<Show when={test} fallback={…}>…</Show>`. */
function show(
  test: AstExpression,
  children: readonly RenderNode[],
  fallback: readonly RenderNode[] | undefined,
  context: JsxContext,
  imports: ImportSet,
): AstExpression {
  const attributes = [when(test)];
  if (fallback) attributes.push(fallbackAttribute(fallback, context));
  return js.jsxElement(imports.add("solid-js", "Show"), attributes, jsxChildren(children, context));
}

function when(test: AstExpression): JsxAttribute {
  return js.jsxAttribute("when", js.jsxExpressionContainer(test));
}

/**
 * `fallback="text"` for static text that a quoted value can hold, else `fallback={…}`: one node,
 * or a fragment of several.
 */
function fallbackAttribute(children: readonly RenderNode[], context: JsxContext): JsxAttribute {
  const [only] = children;
  if (children.length === 1 && only?.kind === "Text") {
    return js.jsxAttribute("fallback", jsxAttributeValue(only.value));
  }
  return js.jsxAttribute("fallback", js.jsxExpressionContainer(jsxBranch(children, context)));
}

/** A branch's children; `{null}` for an empty one, which `<Match>` needs to stop the chain. */
function branchChildren(children: readonly RenderNode[], context: JsxContext): JsxChild[] {
  if (children.length) return jsxChildren(children, context);
  return [js.jsxExpressionContainer(js.nullLiteral())];
}

/**
 * A list as `<For each={source}>{(item, index) => <li>…</li>}</For>`. `<For>` keys its rows
 * by the items themselves, so the source's `key` is not printed (Solid's elements take no
 * `key`; design §1.4 guarantees content and order only), and the index is an accessor, which
 * the rewrite rules call (`index()`). A parameter nothing reads is left out (L5), the item too
 * when the index is not read either.
 */
function list(node: ForNode, context: JsxContext, imports: ImportSet): AstExpression {
  const item = jsxBinding(node.item, context);
  const index = node.index === undefined ? undefined : jsxBinding(node.index, context);
  const parameters = [];
  if (index && context.referenced.has(index.id)) {
    parameters.push(js.bindingIdentifier(item.name), js.bindingIdentifier(index.name));
  } else if (context.referenced.has(item.id)) {
    parameters.push(js.bindingIdentifier(item.name));
  }
  return js.jsxElement(
    imports.add("solid-js", "For"),
    [js.jsxAttribute("each", js.jsxExpressionContainer(jsxExpression(node.source, context)))],
    [js.jsxExpressionContainer(js.arrowFunction(parameters, jsxElement(node.body, context)))],
  );
}

/**
 * A `class` from parts. Solid's `class` takes one string (ADR-0038). Static names and toggles
 * alone print as Solid writes them, `class="a b"` and `classList={{ on: active }}`, which
 * toggle each name in place. A dynamic part, or the class of a spread, goes through an inline
 * helper that joins them all into one string (`class={cx("a", tone, { on: active })}`):
 * Solid sets a dynamic `class` whole, which would drop what a `classList` beside it had
 * toggled on.
 */
function classAttribute(
  attribute: ClassAttribute,
  element: ElementNode,
  context: JsxContext,
  helper: () => string,
): JsxAttribute[] {
  const reads = spreadClassReads(element, context);
  const [only] = attribute.items;
  if (
    attribute.items.length === 1 &&
    only?.kind === "Dynamic" &&
    !reads.length &&
    isString(only.value, context.component)
  ) {
    // One string is a `class` as it is.
    return [js.jsxAttribute("class", js.jsxExpressionContainer(jsxExpression(only.value, context)))];
  }
  if (reads.length || attribute.items.some((item) => item.kind === "Dynamic")) {
    return [classCall(helper(), [...classArrayItems(attribute, context), ...reads])];
  }
  const names = attribute.items.flatMap((item) => (item.kind === "Static" ? [item.value] : []));
  const toggles = attribute.items.flatMap((item) =>
    item.kind === "Toggle"
      ? [js.property(item.name, toggleCondition(item.condition, context))]
      : [],
  );
  const attributes: JsxAttribute[] = [];
  if (names.length) attributes.push(js.jsxAttribute("class", jsxAttributeValue(names.join(" "))));
  if (toggles.length) {
    attributes.push(
      js.jsxAttribute("classList", js.jsxExpressionContainer(js.objectExpression(toggles))),
    );
  }
  return attributes;
}

/** `class={cx(…parts)}`. */
function classCall(helper: string, parts: AstExpression[]): JsxAttribute {
  return js.jsxAttribute(
    "class",
    js.jsxExpressionContainer(js.callExpression(js.identifier(helper), parts)),
  );
}

/**
 * A toggle's condition as `classList` takes it, a boolean (or `undefined`): as written when it
 * is one, else in `Boolean(…)`, which tests truthiness as the IR's toggle does.
 */
function toggleCondition(condition: Expression, context: JsxContext): AstExpression {
  const code = jsxExpression(condition, context);
  if (isBoolean(condition, context.component)) return code;
  return js.callExpression(js.identifier("Boolean"), [code]);
}

/** The comparison operators, whose result is always a boolean. */
const COMPARISONS = new Set(["==", "!=", "===", "!==", "<", "<=", ">", ">="]);

/**
 * Whether an expression is a boolean by its syntax (a comparison, a negation, a boolean
 * literal, `Boolean(…)`, and `&&`, `||` or `?:` of those), or by the declared type of the
 * prop it reads (`boolean`, which `classList` takes as it is). Anything else may be another
 * kind, which `classList`'s type rejects, so the caller wraps it.
 */
function isBoolean(expression: Expression, component: UfComponent): boolean {
  const type = propType(expression, component);
  if (type !== undefined) return type === "boolean";
  const syntactic = (node: AstExpression): boolean => {
    switch (node.type) {
      case "Literal":
        return typeof node.value === "boolean";
      case "UnaryExpression":
        return node.operator === "!";
      case "BinaryExpression":
        return COMPARISONS.has(node.operator);
      case "LogicalExpression":
        return node.operator !== "??" && syntactic(node.left) && syntactic(node.right);
      case "ConditionalExpression":
        return syntactic(node.consequent) && syntactic(node.alternate);
      case "CallExpression":
        return isGlobalCall(node, "Boolean");
      default:
        return false;
    }
  };
  return syntactic(parseExpression(expression.code));
}

/** `string`, or a union of string literal types (`"info" | "warn"`), as a prop declares it. */
const STRING_TYPE = /^(?:string|"[^"\\]*"|'[^'\\]*')(?:\s*\|\s*(?:string|"[^"\\]*"|'[^'\\]*'))*$/;

/**
 * Whether an expression is a string by its syntax (a string or template literal, `String(…)`,
 * a `+` with a string operand, a `?:` of those), or by the declared type of the prop it reads
 * (`string` or string literals, which Solid's `class` takes as it is; never `null`). Anything
 * else may be another kind, which `class`'s type rejects.
 */
function isString(expression: Expression, component: UfComponent): boolean {
  const type = propType(expression, component);
  if (type !== undefined) return STRING_TYPE.test(type);
  const syntactic = (node: AstExpression): boolean => {
    switch (node.type) {
      case "Literal":
        return typeof node.value === "string";
      case "TemplateLiteral":
        return true;
      case "BinaryExpression":
        return (
          node.operator === "+" &&
          (syntactic(node.left as AstExpression) || syntactic(node.right))
        );
      case "ConditionalExpression":
        return syntactic(node.consequent) && syntactic(node.alternate);
      case "CallExpression":
        return isGlobalCall(node, "String");
      default:
        return false;
    }
  };
  return syntactic(parseExpression(expression.code));
}

/**
 * The type a prop declares, as written, when the expression is exactly a read of that prop
 * (`tone`, `props.tone`); `undefined` for anything else, a list's item included.
 */
function propType(expression: Expression, component: UfComponent): string | undefined {
  const [only] = expression.refs;
  if (
    only?.kind !== "Binding" ||
    expression.refs.length !== 1 ||
    only.span.start !== expression.span.start ||
    only.span.end !== expression.span.end
  ) {
    return undefined;
  }
  return component.props.find((prop) => prop.binding === only.binding)?.type.code.trim() ?? "";
}

/** Whether a node calls a global function with one argument: `Boolean(x)`, `String(x)`. */
function isGlobalCall(node: AstExpression, name: string): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === name &&
    !node.optional &&
    node.arguments.length === 1 &&
    node.arguments[0]!.type !== "SpreadElement"
  );
}

/**
 * A `style` as an object with kebab-case keys, which Solid sets one property at a time
 * (`setStyleProperty`, removing it for a nullish value): a camelCase key would be no CSS
 * property at all. A number literal prints as its string, which renders alike, because
 * `solid/style-prop` asks for a unit on any number whose property names a length
 * (`line-height` included).
 */
function styleAttribute(attribute: StyleAttribute, context: JsxContext): JsxAttribute {
  const declarations = attribute.declarations.map(
    (declaration): [string, AstExpression] => [
      declaration.property,
      declaration.kind === "Static"
        ? js.stringLiteral(declaration.value)
        : (numberLiteral(declaration.value) ?? jsxExpression(declaration.value, context)),
    ],
  );
  return js.jsxAttribute("style", js.jsxExpressionContainer(js.objectExpression(declarations)));
}

/** A number literal (`1.5`, `-1`) as the string it renders as, or `undefined`. */
function numberLiteral(expression: Expression): AstExpression | undefined {
  if (expression.refs.length) return undefined;
  const node = parseExpression(expression.code);
  const value =
    node.type === "Literal" && typeof node.value === "number"
      ? node.value
      : node.type === "UnaryExpression" &&
          (node.operator === "-" || node.operator === "+") &&
          node.argument.type === "Literal" &&
          typeof node.argument.value === "number"
        ? node.operator === "-"
          ? -node.argument.value
          : node.argument.value
        : undefined;
  return value === undefined ? undefined : js.stringLiteral(String(value));
}

/**
 * The inline class helper (emulated `class-binding`, ADR-0038), printed after the component:
 * Vue's class semantics for the parts the output passes it, strings as they are and the names
 * of an object's truthy entries, joined with spaces. Its parameters are `unknown`, so a part of
 * any type the analyser accepts type-checks.
 */
function classHelperCode(name: string): string {
  return `/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function ${name}(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}`;
}
