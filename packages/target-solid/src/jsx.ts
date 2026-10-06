// How Solid writes what its JSX writes differently from the codegen defaults (design §5.4):
// control flow through Solid's own components (`<Show>`, `<Switch>`/`<Match>`, `<For>`), which
// update the DOM in place where a ternary or `.map` would recreate it, keyed where a branch reads
// what its tests narrow (src/narrowing.ts); `class` as one string; kebab-case style objects; and
// an object spread for an attribute Solid's types reject on its element (src/attributes.ts).
// Everything else (elements, text, bound attributes, spreads key by key) prints as the defaults
// do, with HTML attribute names, which Solid's JSX takes.
import {
  boundJsxAttribute,
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
  spreadRead,
  staticJsxAttribute,
} from "@unframework/codegen";
import type { ImportSet, JsxContext, JsxDialect } from "@unframework/codegen";
import type {
  ClassAttribute,
  ElementNode,
  Expression,
  ForNode,
  IfNode,
  RenderNode,
  StyleAttribute,
  UfComponent,
} from "@unframework/ir";

import { isUntyped, untypedAttribute } from "./attributes.ts";
import {
  carriedPaths,
  declaresFalsyLiteral,
  negatedOperand,
  Narrowings,
  pathExpression,
  wholePath,
} from "./narrowing.ts";
import type { ReferencePath } from "./narrowing.ts";
import { escapedOnServer } from "./render.ts";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type AstExpression = Parameters<typeof js.callExpression>[0];
type JsxAttribute = ReturnType<typeof js.jsxAttribute>;
type JsxAttributeItem = JsxAttribute | ReturnType<typeof js.jsxSpreadAttribute>;
type JsxChild = ReturnType<typeof jsxChildren>[number];

/** The class helper's name, before the name scope makes it unique. */
export const CLASS_HELPER = "cx";

/** The Solid dialect of one output file, and the helpers its JSX ended up calling. */
export interface SolidJsx {
  dialect: JsxDialect;
  /** The inline helpers to print after the component, as source code. */
  helpers: () => string[];
}

/**
 * The Solid dialect for one output file. Imports (`Show`, `For`…), the class helper's name and
 * the names keyed callbacks give their values are claimed from the file's name scope when first
 * used, so they never capture a source name (`sourceNames`, which that scope reserves). `types`
 * are the texts of the props' types and the declarations they reach.
 */
export function solidJsx(
  imports: ImportSet,
  sourceNames: ReadonlySet<string>,
  component: UfComponent,
  types: readonly string[],
): SolidJsx {
  let helper: string | undefined;
  const classHelper = () => (helper ??= imports.claim(CLASS_HELPER));
  const flow: Flow = {
    imports,
    narrowings: new Narrowings(imports, sourceNames, component),
    falsy: declaresFalsyLiteral(types),
  };
  const dialect: JsxDialect = {
    expression: (expression, context) => flow.narrowings.code(expression, context),
    conditional: (node, context) => conditional(node, context, flow),
    list: (node, context) => list(node, context, imports),
    staticAttribute(attribute, element, context) {
      if (attribute.name === "class" && typeof attribute.value === "string") {
        const reads = spreadClassReads(element, context);
        if (reads.length) {
          return [classCall(classHelper(), [js.stringLiteral(attribute.value), ...reads])];
        }
      }
      if (!isUntyped(element.tag, attribute.name)) {
        return staticJsxAttribute(attribute, element, context);
      }
      const value = js.stringLiteral(attribute.value === true ? "" : attribute.value);
      return untypedJsxAttribute(element, attribute.name, value);
    },
    boundAttribute: (attribute, element, context) =>
      isUntyped(element.tag, attribute.name)
        ? untypedJsxAttribute(element, attribute.name, jsxExpression(attribute.value, context))
        : boundJsxAttribute(attribute, element, context),
    spreadAttribute(attribute, element, context) {
      // One attribute per declared key (ADR-0039); a `class` key goes to the element's own
      // `class`, which merges it, when the element has one.
      const merged = element.attributes.some(
        (item) => item.kind === "Class" || (item.kind === "Static" && item.name === "class"),
      );
      return attribute.keys
        .filter((key) => !(merged && key.name === "class"))
        .flatMap((key) => {
          const value = spreadRead(attribute, key, context);
          return isUntyped(element.tag, key.name)
            ? untypedJsxAttribute(element, key.name, value)
            : [js.jsxAttribute(key.name, js.jsxExpressionContainer(value))];
        });
    },
    classAttribute: (attribute, element, context) =>
      classAttribute(attribute, element, context, classHelper),
    styleAttribute: (attribute, element, context) => [styleAttribute(attribute, context)],
  };
  return { dialect, helpers: () => (helper ? [classHelperCode(helper)] : []) };
}

/** What a file's control flow prints with: its imports, and the keyed callbacks around it. */
interface Flow {
  imports: ImportSet;
  narrowings: Narrowings;
  /** Whether a value its truthiness test narrows may be typed with a falsy literal. */
  falsy: boolean;
}

/**
 * A conditional as Solid's control flow, which keeps a branch's DOM while its condition stays
 * truthy. Both test truthiness, as the IR does (ADR-0036: `0` takes the fallback):
 *
 * - one condition: `<Show when={c} fallback={…}>…</Show>`; an empty first branch before an
 *   else shows the else under the negated condition (`c ? null : <B />` → `<Show when={!c}>`,
 *   and `!c ? null : <B />` → `<Show when={c}>`);
 * - more: `<Switch fallback={…}><Match when={a}>…</Match><Match when={b}>…</Match></Switch>`,
 *   where an empty branch still stops the chain with `{null}`, as Solid's types require
 *   children (design §5.4).
 *
 * `<Show>`'s and `<Match>`'s children are no branch of their condition to TypeScript. A branch
 * that reads a binding its tests mention (those that hold or fail where it renders) takes the
 * values it reads from them through a keyed callback instead (see {@link keyed}). An else that
 * does is a last keyed `<Match>`, as is every such branch of a chain, whose `when` repeats the
 * chain up to it; `<Match>` evaluates a condition only where those before it failed.
 */
function conditional(node: IfNode, context: JsxContext, flow: Flow): AstExpression {
  const { branches } = node;
  const tests = branches.flatMap((branch) => (branch.condition ? [branch.condition] : []));
  const testsOf = (index: number) =>
    branches[index]!.condition ? tests.slice(0, index + 1) : tests;
  const around = flow.narrowings.carried();
  const carried = branches.map((branch, index) =>
    carriedPaths(branch.children, testsOf(index), Boolean(branch.condition), around),
  );
  if (carried.every((paths) => !paths.length)) return plain(node, context, flow.imports);
  const last = branches.at(-1)!;
  // The analyser drops an empty else.
  const otherwise = last.condition ? undefined : last;
  const element = (name: string, attributes: JsxAttribute[], children: JsxChild[]) =>
    js.jsxElement(flow.imports.add("solid-js", name), attributes, children);
  if (tests.length === 1) {
    const [first] = branches;
    const test = first!.condition!;
    if (!otherwise || !carried[1]!.length) {
      const shown = keyed([test], true, first!.children, carried[0]!, context, flow);
      const attributes = [js.jsxAttribute("keyed"), when(shown.when)];
      if (otherwise) attributes.push(fallbackAttribute(otherwise.children, context));
      return element("Show", attributes, [shown.callback]);
    }
    // `!user ? <i>anon</i> : <p>{user.name}</p>`: the else shows where the operand holds.
    const operand = negatedOperand(test);
    if (operand && !carried[0]!.length) {
      const paths = carriedPaths(otherwise.children, [operand], true, around);
      const shown = keyed([operand], true, otherwise.children, paths, context, flow);
      const attributes = [js.jsxAttribute("keyed"), when(shown.when)];
      if (first!.children.length) attributes.push(fallbackAttribute(first!.children, context));
      return element("Show", attributes, [shown.callback]);
    }
    if (!first!.children.length) {
      // `c ? null : <B />`: the else alone, under the test failing.
      const shown = keyed([test], false, otherwise.children, carried[1]!, context, flow);
      return element("Show", [js.jsxAttribute("keyed"), when(shown.when)], [shown.callback]);
    }
  }
  const matches = branches.flatMap((branch, index) => {
    if (!branch.condition && !carried[index]!.length) return [];
    if (!carried[index]!.length) {
      // An empty branch still stops the chain, with `{null}`: `<Match>` requires children.
      return [
        element(
          "Match",
          [when(jsxExpression(branch.condition!, context))],
          branch.children.length
            ? jsxChildren(branch.children, context)
            : [js.jsxExpressionContainer(js.nullLiteral())],
        ),
      ];
    }
    const holds = Boolean(branch.condition);
    const shown = keyed(testsOf(index), holds, branch.children, carried[index]!, context, flow);
    return [element("Match", [js.jsxAttribute("keyed"), when(shown.when)], [shown.callback])];
  });
  const fallback =
    otherwise && !carried.at(-1)!.length ? [fallbackAttribute(otherwise.children, context)] : [];
  return element("Switch", fallback, matches);
}

/** A conditional none of whose branches reads what its tests mention: see {@link conditional}. */
function plain(node: IfNode, context: JsxContext, imports: ImportSet): AstExpression {
  const last = node.branches.at(-1)!;
  const tests = last.condition ? node.branches : node.branches.slice(0, -1);
  // The analyser drops an empty else; an empty one here would only print `fallback={null}`.
  const fallback = last.condition || last.children.length === 0 ? undefined : last.children;
  const [only] = tests;
  if (only && tests.length === 1) {
    if (only.children.length === 0 && fallback) {
      const operand = negatedOperand(only.condition!);
      const negated = operand
        ? jsxExpression(operand, context)
        : js.unaryExpression("!", jsxExpression(only.condition!, context, "operand"));
      return show(negated, fallback, undefined, context, imports);
    }
    return show(jsxExpression(only.condition!, context), only.children, fallback, context, imports);
  }
  const matches = tests.map((branch) =>
    js.jsxElement(
      imports.add("solid-js", "Match"),
      [when(jsxExpression(branch.condition!, context))],
      // An empty branch still stops the chain, with `{null}`: `<Match>` requires children.
      branch.children.length
        ? jsxChildren(branch.children, context)
        : [js.jsxExpressionContainer(js.nullLiteral())],
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

/**
 * The `when` of a keyed `<Show>` or `<Match>` whose branch reads `paths` of what `tests`
 * mention, and the callback that receives them as plain values. Where the branch shows when
 * its one test, exactly one of those paths, holds, the `when` is that test, and the callback
 * receives its value: `<Show keyed when={props.user}>{(user) => …user.name…}</Show>`. Otherwise
 * the `when` is the source's chain up to the branch, failed tests leaving nothing, which builds
 * an object of the paths where TypeScript narrows them, destructured by the callback:
 * `props.count !== undefined ? { count: props.count } : undefined` and `({ count }) => …`. Its
 * truthiness is the branch's own, and keyed, the callback runs again whenever the value
 * changes, with values that never go stale (src/narrowing.ts).
 */
function keyed(
  tests: readonly Expression[],
  holds: boolean,
  children: readonly RenderNode[],
  paths: readonly ReferencePath[],
  context: JsxContext,
  flow: Flow,
): { when: AstExpression; callback: JsxChild } {
  const { narrowings } = flow;
  const names = narrowings.names(paths, context);
  const frame = { names: paths.map((path, index) => ({ path, name: names[index]! })) };
  const [only] = tests;
  const whole = tests.length === 1 && holds ? wholePath(only!) : undefined;
  const simple =
    whole &&
    paths.length === 1 &&
    paths[0]!.binding === whole.binding &&
    paths[0]!.keys.length === whole.keys.length &&
    paths[0]!.keys.every((key, index) => whole.keys[index] === key);
  let test: AstExpression;
  let parameter: Parameters<typeof js.arrowFunction>[0][number];
  if (simple) {
    // Solid types the value `NonNullable<T>`, which keeps the falsy literals (`""`, `0`) the
    // test removes; `|| undefined` removes them as the test does.
    test = flow.falsy
      ? js.logicalExpression(
          "||",
          jsxExpression(only!, context, "operand"),
          js.identifier("undefined"),
        )
      : jsxExpression(only!, context);
    parameter = js.bindingIdentifier(names[0]!);
  } else {
    const object = js.objectExpression(
      paths.map((path, index) => {
        const value = pathExpression(path, tests, children);
        const name = names[index]!;
        // `{ row }` where the value is already read by its name.
        return narrowings.code(value, context) === name
          ? js.property(name, js.identifier(name), { shorthand: true })
          : [name, jsxExpression(value, context)];
      }),
    );
    const nothing = js.identifier("undefined");
    // From the last test outwards: its own holds (or fails, for an else), the others fail.
    test = holds
      ? js.conditionalExpression(jsxExpression(tests.at(-1)!, context, "test"), object, nothing)
      : object;
    for (const failed of (holds ? tests.slice(0, -1) : tests).toReversed()) {
      test = js.conditionalExpression(jsxExpression(failed, context, "test"), nothing, test);
    }
    parameter = js.objectPattern(names.map((name) => js.bindingProperty(name)));
  }
  // Solid calls a function child untracked: a branch that is one interpolation
  // (`user.name + props.label`) would not update when another prop it reads changes, and a
  // fragment, which Solid compiles to a memo, keeps its reads tracked.
  const body = narrowings.within(frame, () =>
    children.length === 1 && children[0]!.kind === "Interpolation"
      ? js.jsxFragment(jsxChildren(children, context))
      : jsxBranch(children, context),
  );
  return {
    when: test,
    callback: js.jsxExpressionContainer(js.arrowFunction([parameter], body)),
  };
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
 * An attribute Solid's types reject on its element (`isUntyped`), as the object spread Solid
 * renders alike (see `untypedAttribute`).
 */
function untypedJsxAttribute(
  element: ElementNode,
  name: string,
  value: AstExpression,
): JsxAttributeItem[] {
  const object = js.objectExpression([[name, value]]);
  const record = js.typeReference("Record", [js.keywordType("string"), js.keywordType("unknown")]);
  return [
    js.jsxSpreadAttribute(
      untypedAttribute(element.tag, name, hasTypedProps(element)) === "spread"
        ? object
        : js.asExpression(object, record),
    ),
  ];
}

/**
 * Whether an element's props share a key with its type besides the attributes it rejects:
 * children, or an attribute (a spread's key included) the type declares.
 */
function hasTypedProps(element: ElementNode): boolean {
  if (element.children.length) return true;
  return element.attributes.some((attribute) => {
    switch (attribute.kind) {
      case "Static":
      case "Bound":
        return !isUntyped(element.tag, attribute.name);
      case "Spread":
        return attribute.keys.some((key) => !isUntyped(element.tag, key.name));
      default:
        return true;
    }
  });
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
    const value = jsxExpression(escapedOnServer(only.value, "attribute"), context);
    return [js.jsxAttribute("class", js.jsxExpressionContainer(value))];
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
  return isBooleanSyntax(parseExpression(expression.code));
}

/** {@link isBoolean} by syntax alone. */
function isBooleanSyntax(node: AstExpression): boolean {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "boolean";
    case "UnaryExpression":
      return node.operator === "!";
    case "BinaryExpression":
      return COMPARISONS.has(node.operator);
    case "LogicalExpression":
      return node.operator !== "??" && isBooleanSyntax(node.left) && isBooleanSyntax(node.right);
    case "ConditionalExpression":
      return isBooleanSyntax(node.consequent) && isBooleanSyntax(node.alternate);
    case "CallExpression":
      return isGlobalCall(node, "Boolean");
    default:
      return false;
  }
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
  return isStringSyntax(parseExpression(expression.code));
}

/** {@link isString} by syntax alone. */
function isStringSyntax(node: AstExpression): boolean {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string";
    case "TemplateLiteral":
      return true;
    case "BinaryExpression":
      return node.operator === "+" && (isStringSyntax(node.left) || isStringSyntax(node.right));
    case "ConditionalExpression":
      return isStringSyntax(node.consequent) && isStringSyntax(node.alternate);
    case "CallExpression":
      return isGlobalCall(node, "String");
    default:
      return false;
  }
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
  const declarations = attribute.declarations.map((declaration): [string, AstExpression] => [
    declaration.property,
    declaration.kind === "Static"
      ? js.stringLiteral(declaration.value)
      : (numberLiteral(declaration.value) ?? jsxExpression(declaration.value, context)),
  ]);
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
