// Lists (ADR-0036): `source.map((item, index) => <element key={…}>…</element>)` as
// a child lowers to a For, which each target writes as its own loop (`v-for`, `{#each}`,
// `@for`). M1 guarantees a list's content and order; DOM identity on reorder lands later.

import type { Fix } from "@unframework/diagnostics";
import { createBinding, createFor } from "@unframework/ir";
import type { ForNode } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { checkExpression, findToken, shadowing, span } from "./expressions.ts";
import { containsJsx, lowerElement } from "./lower.ts";
import type { Place } from "./lower.ts";
import { angularChecks, narrowingAt, referencePath } from "./narrowing.ts";
import type { LoopVariable, RenderContext } from "./render.ts";
import {
  describe,
  elementsOf,
  mayBeNullish,
  NUMBER,
  outside,
  union,
  UNDEFINED,
} from "./types/kinds.ts";

/** The canonical form, for the messages. */
const CANONICAL = "`source.map((item, index) => <element key={…}>…</element>)`";

/**
 * Lowers a list, `source.map(callback)` whose callback holds JSX, or reports why it cannot be.
 * `source?.map(…)` is reported: `?.` does nothing on a source that is never nullish where it is
 * read (UF3023), and a list cannot render a nullish one (UF3018), which `(source ?? []).map(…)`
 * renders alike. A source that a condition around it tests where the targets' checkers read it
 * differently is not supported yet (UF1002): neither spelling passes every checker.
 */
export function lowerList(
  call: AST.CallExpression,
  place: Place,
  render: RenderContext,
): ForNode | undefined {
  const { reporter, source } = render;
  const mark = reporter.diagnostics.length;
  const callee = call.callee as AST.StaticMemberExpression;
  const checked = checkExpression(callee.object, render);
  // A `?.` inside the source ends the whole chain, `.map` included, as `undefined`.
  const list = checked.shortCircuits
    ? { ...checked, kinds: union(checked.kinds, UNDEFINED) }
    : checked;
  const path = referencePath(callee.object, render);
  const narrowing =
    path && mayBeNullish(list.kinds) ? narrowingAt(callee.object, path, render) : undefined;
  const outsideKinds = outside(list.kinds, ["array"]);
  const token = findToken(
    source,
    callee.object.end,
    callee.property.start,
    callee.optional ? "?." : ".",
  );
  // `?.` says the source can be nullish, whatever kinds the model reads.
  const optional = callee.optional && mayBeNullish(list.kinds);
  if (narrowing?.kind === "unfollowed" && angularChecks(path!, render)) {
    // Angular narrows the source, where it rejects `??` (NG8102), and a JSX target's callback
    // or a form the compiler does not follow may not, where `.map` fails its type check.
    reporter.report(
      "UF1002",
      callee.object,
      narrowing.reason === "callback"
        ? "A list over a property that may be absent is not supported yet in a list's callback when a condition outside it tests the property: Angular's checker narrows it there, where it rejects `(source ?? []).map(…)` (NG8102), and TypeScript does not narrow a property inside the JSX targets' callbacks, where `source.map(…)` fails their type check."
        : "A list over a value that may be absent is not supported yet where a condition around it tests the value in a form the compiler does not follow (an equality with a value that is no literal, such as `member === current`): Angular's checker may narrow it there, where it rejects `(source ?? []).map(…)` (NG8102), and the compiler cannot tell whether every target's checker takes `source.map(…)`.",
      {
        help: "Test the source itself (`items && …`, `items !== undefined && …`), inside the list's callback if it is in one, or give the prop the default `[]`.",
        related: [{ span: span(narrowing.condition), message: "The condition tests it here" }],
      },
    );
  } else if (outsideKinds.length || optional) {
    const nullable = outsideKinds.every((kind) => kind === "null" || kind === "undefined");
    // `source?.map(…)`, and a chain a `?.` in the source ends, render nothing for a nullish
    // source, as `(source ?? []).map(…)` does.
    const fixes: Fix[] =
      (optional || checked.shortCircuits) && nullable && token
        ? [
            {
              title: "Write `(source ?? []).map(…)`",
              confidence: "safe",
              edits: [
                { span: { start: callee.object.start, end: callee.object.start }, text: "(" },
                {
                  span: { start: token.start, end: token.start + (callee.optional ? 2 : 1) },
                  text: " ?? []).",
                },
              ],
            },
          ]
        : [];
    reporter.report(
      "UF3018",
      callee.object,
      outsideKinds.length
        ? `A list renders an array, and this source can be ${describe(outsideKinds)}, which the targets iterate differently.`
        : "A list renders an array, and `?.` reads this source as one that can be `null` or `undefined`, which the targets iterate differently.",
      {
        help: nullable
          ? "Default it to an empty array: `(items ?? []).map(…)`, or give the prop the default `[]`."
          : "Render an array.",
        ...(fixes.length ? { fixes } : {}),
      },
    );
  }
  if (callee.optional && !mayBeNullish(list.kinds)) {
    if (token) {
      reporter.report(
        "UF3023",
        { start: token.start, end: token.start + 2 },
        "`?.` reads from a value that is never null or undefined, so it does nothing.",
        {
          help: "Remove the `?`.",
          fixes: [
            {
              title: "Write `.`",
              confidence: "safe",
              edits: [{ span: { start: token.start, end: token.start + 2 }, text: "." }],
            },
          ],
        },
      );
    }
  }
  // `.map?.(…)`: an array's `map` is always there, and each output calls it plainly.
  const optionalCall = call.optional
    ? findToken(source, callee.end, call.arguments[0]?.start ?? call.end, "?.")
    : undefined;
  if (optionalCall) {
    const at = { start: optionalCall.start, end: optionalCall.start + 2 };
    reporter.report("UF3023", at, "`?.` calls a method that is always there, so it does nothing.", {
      help: "Remove the `?.`.",
      fixes: [{ title: "Remove `?.`", confidence: "safe", edits: [{ span: at, text: "" }] }],
    });
  }
  const [callback, ...others] = call.arguments;
  if (others.length || !callback || callback.type !== "ArrowFunctionExpression") {
    reporter.report(
      "UF3015",
      callback && callback.type !== "SpreadElement" ? callback : call,
      `A list's \`.map\` takes one arrow function: ${CANONICAL}.`,
      { help: "Write the callback as an arrow function that returns one element." },
    );
    return undefined;
  }
  const body = bodyOf(callback);
  // The parameters: the item, and its index. Anything else is reported, and the body is still
  // checked, without them.
  const parameters = callback.params;
  let valid = parameters.length >= 1 && parameters.length <= 2;
  if (!valid) {
    reporter.report(
      "UF3015",
      parameters[2] ?? callback,
      `A list's callback takes the item and, optionally, its index: ${CANONICAL}.`,
    );
  }
  for (const parameter of parameters.slice(0, 2)) {
    if (parameter.type !== "Identifier" || parameter.optional) {
      valid = false;
      reporter.report(
        "UF3015",
        parameter,
        `A list's callback takes the item and its index as plain names: ${CANONICAL}.`,
        {
          help:
            parameter.type === "ObjectPattern"
              ? "Name the item, and read its members as `item.name`."
              : parameter.type === "ArrayPattern"
                ? "Name the item, and read its parts as `entry[0]` and `entry[1]`."
                : "Name the parameter.",
        },
      );
    } else if (parameter.typeAnnotation) {
      reporter.unsupported(
        parameter.typeAnnotation,
        "Type annotations on a list's parameters are not supported yet: Angular's templates have no TypeScript syntax.",
        { help: "Remove the annotation: the parameters' types come from the list." },
      );
    }
  }
  if (callback.async || callback.typeParameters || callback.returnType) {
    reporter.unsupported(
      callback,
      "A list's callback is a plain arrow function: no `async`, type parameters or return type.",
    );
  }
  if (!body) {
    const { message, help } = bodyProblem(callback);
    reporter.report("UF3015", callback.body, message, { help });
    return undefined;
  }
  // The loop variables: in scope in the key and the body.
  const variables: LoopVariable[] = [];
  if (valid) {
    for (const [position, parameter] of parameters.entries()) {
      const identifier = parameter as AST.BindingIdentifier;
      if (shadowing(identifier, render)) valid = false;
      const binding = createBinding(identifier.name, "loopVar", {
        start: identifier.start,
        end: identifier.start + identifier.name.length,
      });
      render.bindings.push(binding);
      const variable: LoopVariable = {
        name: identifier.name,
        id: binding.id,
        kinds: position === 0 ? elementsOf(list.kinds) : NUMBER,
        declaration: identifier,
      };
      render.loopVariables.set(identifier, variable);
      variables.push(variable);
    }
  }
  render.enclosing.push(...variables);
  const lowered = lowerElement(body, place, render, true);
  // Read off the source: an element the analyser cannot check still has its key, which is
  // JSX's `key` only, in lower case.
  const written = body.openingElement.attributes.find(
    (attribute): attribute is AST.JSXAttribute =>
      attribute.type === "JSXAttribute" &&
      attribute.name.type === "JSXIdentifier" &&
      attribute.name.name === "key",
  );
  const key = valid
    ? lowerKey(lowered.key ?? written, body, callback, variables, render)
    : undefined;
  render.enclosing.splice(render.enclosing.length - variables.length, variables.length);
  // `<component is>` is no list's body: `lowerDynamic` reports it there.
  if (!lowered.element || lowered.element.kind === "Dynamic") return undefined;
  if (!key || !valid || reporter.hasErrorsSince(mark)) return undefined;
  const [item, index] = variables;
  return createFor(list.expression, item!.id, key, lowered.element, span(call), index?.id);
}

/** The element a list's callback returns: its expression body, or a block's only `return`. */
function bodyOf(callback: AST.ArrowFunctionExpression): AST.JSXElement | undefined {
  let { body } = callback;
  if (body.type === "BlockStatement") {
    const statements = body.body.filter((statement) => statement.type !== "EmptyStatement");
    const only = statements.length === 1 ? statements[0] : undefined;
    if (only?.type !== "ReturnStatement" || !only.argument) return undefined;
    body = only.argument;
  }
  return body.type === "JSXElement" ? body : undefined;
}

/**
 * Why a callback's body is not one element, and what to write: an item that renders one element
 * or another keeps its place in one element that holds the conditional; one that renders or not
 * is filtered out first.
 */
function bodyProblem(callback: AST.ArrowFunctionExpression): { message: string; help: string } {
  const { body } = callback;
  const returned =
    body.type === "BlockStatement"
      ? (
          body.body.find((statement) => statement.type === "ReturnStatement") as
            | AST.ReturnStatement
            | undefined
        )?.argument
      : body;
  if (returned?.type === "JSXFragment") {
    return {
      message: `A list renders one element per item, and a fragment cannot carry the item's key: ${CANONICAL}.`,
      help: "Wrap the elements in one element, and key it: `<li key={item.id}>…</li>`.",
    };
  }
  if (returned?.type === "JSXElement") {
    return {
      message: `A list's callback only returns its element: ${CANONICAL}.`,
      help: "Remove the other statements, and return the element.",
    };
  }
  if (
    returned?.type === "ConditionalExpression" &&
    containsJsx(returned.consequent) &&
    containsJsx(returned.alternate)
  ) {
    return {
      message: `A list renders one element per item, not a conditional: return one element that holds the conditional, ${CANONICAL}.`,
      help: "Move the conditional into one keyed element, which every item renders: `<li key={item.id}>{item.href ? <a href={item.href}>…</a> : <span>…</span>}</li>`.",
    };
  }
  if (returned && containsJsx(returned)) {
    return {
      message: `A list renders one element per item, not a conditional: filter the list first, then ${CANONICAL}.`,
      help: "Filter the list first (`items.filter((item) => item.shown).map(…)`), and return one element.",
    };
  }
  return {
    message: `A list's callback returns one element: ${CANONICAL}.`,
    help: "Return one element, keyed by the item: `<li key={item.id}>…</li>`.",
  };
}

/**
 * Lifts a list's key off its element (ADR-0036): an expression that reads the item or the
 * index and is a string or a number. A missing key (UF3013) and a constant one (UF3014) get a
 * fix that keys the element by its index, adding the index parameter under a free name.
 */
function lowerKey(
  attribute: AST.JSXAttribute | undefined,
  body: AST.JSXElement,
  callback: AST.ArrowFunctionExpression,
  variables: readonly LoopVariable[],
  render: RenderContext,
) {
  const { reporter } = render;
  const value = attribute?.value;
  if (!attribute || !value || value.type !== "JSXExpressionContainer") {
    const fix = indexKeyFix(attribute, body, callback, render);
    if (!attribute) {
      reporter.report(
        "UF3013",
        body.openingElement.name,
        "A list's element needs a `key`: the frameworks match each item's element across renders by it.",
        {
          help: "Key it by something unique and stable in the item: `key={item.id}`.",
          fixes: [fix],
        },
      );
    } else {
      reporter.report(
        "UF3014",
        attribute,
        "A constant `key` gives every item of the list the same key, which the frameworks need to tell the items apart.",
        {
          help: "Key the element by something unique and stable in the item: `key={item.id}`.",
          fixes: [fix],
        },
      );
    }
    return undefined;
  }
  if (value.expression.type === "JSXEmptyExpression") {
    reporter.unsupported(value, "A `key` cannot be empty.", { help: "Write `key={item.id}`." });
    return undefined;
  }
  const checked = checkExpression(value.expression, render);
  const outsideKinds = outside(checked.kinds, ["string", "number"]);
  if (outsideKinds.length) {
    reporter.report(
      "UF3018",
      value.expression,
      `A list's key is a string or a number, and this one can be ${describe(outsideKinds)}, which the targets compare differently.`,
      { help: "Key the element by a string or a number in the item: `key={item.id}`." },
    );
    return undefined;
  }
  const reads = checked.expression.refs.some(
    (ref) => ref.kind === "Binding" && variables.some((variable) => variable.id === ref.binding),
  );
  if (!reads) {
    reporter.report(
      "UF3018",
      value.expression,
      `The key must identify the item: read \`${variables[0]?.name ?? "item"}\` or ${variables[1] ? `\`${variables[1].name}\`` : "the index"}. A key that reads neither is the same for every item, which Vue and Svelte reject.`,
      { help: "Key the element by something unique and stable in the item: `key={item.id}`." },
    );
    return undefined;
  }
  // Angular's `track` reads only its own item, `$index` and the component's members (NG8009).
  const outer = render.enclosing.find(
    (variable) =>
      !variables.includes(variable) &&
      checked.expression.refs.some((ref) => ref.kind === "Binding" && ref.binding === variable.id),
  );
  if (outer) {
    reporter.report(
      "UF3018",
      value.expression,
      `The key must identify the item within its own list, and this one reads \`${outer.name}\`, a variable of a list around it, which Angular's \`track\` cannot read.`,
      {
        help: `Key the element by its own item: \`key={${variables[0]?.name ?? "item"}.id}\`.`,
      },
    );
    return undefined;
  }
  return checked.expression;
}

/**
 * Keys a list's element by its index: `key={index}`, written over a constant key or after the
 * tag name, with the index parameter added when the callback has none, under a name nothing in
 * the component uses.
 */
function indexKeyFix(
  attribute: AST.JSXAttribute | undefined,
  body: AST.JSXElement,
  callback: AST.ArrowFunctionExpression,
  render: RenderContext,
): Fix {
  const { source } = render;
  const [item, existing] = callback.params as AST.BindingIdentifier[];
  const component = source.slice(render.component.start, render.component.end);
  let name = existing?.name;
  const edits: Fix["edits"] = [];
  if (!name) {
    name = "index";
    for (let suffix = 2; !free(name, component, render); suffix++) name = `index${suffix}`;
    const parenthesised = source[callback.start] === "(";
    edits.push(
      parenthesised
        ? { span: { start: item!.end, end: item!.end }, text: `, ${name}` }
        : { span: span(item!), text: `(${source.slice(item!.start, item!.end)}, ${name})` },
    );
  }
  const key = `key={${name}}`;
  edits.push(
    attribute
      ? { span: span(attribute), text: key }
      : {
          span: { start: body.openingElement.name.end, end: body.openingElement.name.end },
          text: ` ${key}`,
        },
  );
  return { title: `Key the element by its index, \`${key}\``, confidence: "likely", edits };
}

/** Whether a name is used nowhere in the component, and is no prop's. */
function free(name: string, component: string, render: RenderContext): boolean {
  return !render.props.has(name) && !new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(component);
}
