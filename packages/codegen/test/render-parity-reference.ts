// The reference semantics of a component (ADR-0034 to ADR-0040): what it renders for its props, as
// a static tree. The render-parity kit compares every target's rendered DOM with this, so this is
// the oracle the seven targets are held to. It evaluates the IR, not an output: expressions run as
// JavaScript (`new Function`, test code), with every name bound by the scope the source declares
// (props, list variables), so it does not trust the references the analyser resolved, which the
// targets' rewrites do. Everything a target may render differently is a run-time value outside the
// contract (ADR-0035), and the evaluator refuses it, so no case can hold one.
//
// It imports only the IR, and runs anywhere.
import {
  BINDABLE_BOOLEAN_ATTRIBUTES,
  canonicalNumber,
  createElement,
  createFragment,
  createStaticAttribute,
  createText,
  elementNamespace,
  isCustomProperty,
  isJavaScriptUrl,
  NUMERIC_ATTRIBUTES,
  UNITLESS_PROPERTIES,
  URL_ATTRIBUTES,
} from "@unframework/ir";
import type {
  Attribute,
  ElementNode,
  Expression,
  FragmentNode,
  Namespace,
  RenderNode,
  StaticAttribute,
  UfComponent,
} from "@unframework/ir";

const at = { start: 0, end: 0 };

/** The names an expression can read, and their values. */
type Scope = ReadonlyMap<string, unknown>;

/**
 * What a component renders for its props, as static IR: elements with static attributes, and
 * text. `props` holds the props by name; a key left out, or set to `undefined`, is an absent
 * prop, which takes its default (ADR-0034). The rules, each from ADR-0034 to ADR-0040:
 * - an Interpolation renders a string as it is, a number as `String()` does, and nothing for
 *   `null` or `undefined`;
 * - an If renders its first branch whose condition is truthy, as `v-if` decides, or its else;
 * - a For renders its body once per item of its source, with the item and index in scope;
 * - a root Fragment renders its children;
 * - a Bound attribute is absent for `null` or `undefined`; a bindable boolean attribute is
 *   present for `true` and absent for `false`; ARIA's, `contenteditable`, `draggable` and
 *   `spellcheck` render a boolean as `"true"` or `"false"`; strings and numbers render as text;
 * - a Class renders the union of its static names, its toggles whose condition is truthy and the
 *   names its dynamic parts hold, and no `class` at all when that is empty;
 * - a Style renders its static declarations and its bound ones whose value is neither nullish
 *   nor `""`, and no `style` at all when none is left;
 * - a Spread renders exactly the keys its type declares, each as a bound attribute of that name
 *   would, its `class` merged into the element's.
 *
 * It throws on a value the contract leaves out (ADR-0035), such as a boolean or a non-finite
 * number rendered as text, a duplicate list key or a `javascript:` URL: such a case would test
 * nothing.
 */
export function instantiate(
  component: UfComponent,
  props: Readonly<Record<string, unknown>>,
): ElementNode | FragmentNode {
  const scope = new Map<string, unknown>();
  const { propsParameter } = component;
  if (propsParameter?.form === "object") {
    // The object form takes no defaults (ADR-0001): the object is the props as passed.
    scope.set(propsParameter.name!, { ...props });
  } else {
    for (const prop of component.props) {
      if (prop.binding === undefined) continue;
      const passed = props[prop.name];
      const value =
        passed === undefined && prop.default
          ? evaluate(prop.default, new Map(), "a default")
          : passed;
      scope.set(nameOf(component, prop.binding), value);
    }
  }
  const evaluator = new Evaluator(component);
  const { render } = component;
  if (render.kind === "Element") return evaluator.element(render, scope, "html");
  return createFragment(evaluator.children(render.children, scope, "html"), at);
}

/** A binding's name, by its id. */
function nameOf(component: UfComponent, id: string): string {
  const binding = component.bindings.find((each) => each.id === id);
  if (!binding) throw new Error(`no binding ${id}`);
  return binding.name;
}

class Evaluator {
  private readonly component: UfComponent;

  constructor(component: UfComponent) {
    this.component = component;
  }

  element(node: ElementNode, scope: Scope, parent: Namespace): ElementNode {
    const namespace = elementNamespace(node.tag, parent);
    return createElement(
      node.tag,
      this.attributes(node, scope, namespace),
      this.children(node.children, scope, namespace),
      at,
    );
  }

  /** The static nodes a list of children renders, with adjacent texts merged. */
  children(nodes: readonly RenderNode[], scope: Scope, namespace: Namespace): RenderNode[] {
    const rendered: RenderNode[] = [];
    const text = (value: string) => {
      if (value === "") return;
      const last = rendered.at(-1);
      if (last?.kind === "Text") rendered[rendered.length - 1] = createText(last.value + value, at);
      else rendered.push(createText(value, at));
    };
    const visit = (node: RenderNode, names: Scope): void => {
      switch (node.kind) {
        case "Element":
          rendered.push(this.element(node, names, namespace));
          return;
        case "Text":
          text(node.value);
          return;
        case "Interpolation":
          text(interpolated(node.value, names));
          return;
        case "If": {
          const branch = node.branches.find(
            ({ condition }) => !condition || Boolean(evaluate(condition, names, "a condition")),
          );
          for (const child of branch?.children ?? []) visit(child, names);
          return;
        }
        case "For": {
          const items = evaluate(node.source, names, "a list source");
          if (!Array.isArray(items)) throw outside(node.source, `${String(items)} is no array`);
          const keys = new Set<string>();
          // A loop by index, as `forEach` skips a hole a target's loop would render.
          for (let index = 0; index < items.length; index++) {
            if (!(index in items)) throw outside(node.source, `a sparse array (hole at ${index})`);
            const item: unknown = items[index];
            const inner = new Map(names);
            inner.set(nameOf(this.component, node.item), item);
            if (node.index !== undefined) inner.set(nameOf(this.component, node.index), index);
            const key = evaluate(node.key, inner, "a key");
            if (typeof key !== "string" && typeof key !== "number") {
              throw outside(node.key, `a key is ${typeof key}`);
            }
            // React's keys are strings: `1` and `"1"` are the same key there.
            if (keys.has(String(key))) throw outside(node.key, `the key ${String(key)} repeats`);
            keys.add(String(key));
            visit(node.body, inner);
          }
          return;
        }
        default:
          throw new Error(`unknown node ${(node satisfies never as RenderNode).kind}`);
      }
    };
    for (const node of nodes) visit(node, scope);
    return rendered;
  }

  /** An element's attributes, each rendered by its kind, as static attributes. */
  attributes(node: ElementNode, scope: Scope, namespace: Namespace): StaticAttribute[] {
    const values = new Map<string, string | true>();
    const set = (name: string, value: string | true | undefined) => {
      if (values.has(name)) throw new Error(`<${node.tag}> sets ${name} twice`);
      if (value !== undefined) values.set(name, value);
    };
    const classes: string[] = [];
    let style: string[] | undefined;
    for (const attribute of node.attributes as readonly Attribute[]) {
      switch (attribute.kind) {
        case "Static":
          if (attribute.name === "class" && typeof attribute.value === "string") {
            classes.push(...tokens(attribute.value));
          } else {
            set(attribute.name, attribute.value);
          }
          break;
        case "Bound":
          set(
            attribute.name,
            boundValue(node.tag, attribute.name, namespace, attribute.value, scope),
          );
          break;
        case "Class":
          for (const item of attribute.items) {
            if (item.kind === "Static") classes.push(...tokens(item.value));
            else if (item.kind === "Toggle") {
              if (evaluate(item.condition, scope, "a class toggle")) classes.push(item.name);
            } else classes.push(...classTokens(item.value, evaluate(item.value, scope, "a class")));
          }
          break;
        case "Style":
          style = attribute.declarations.flatMap((declaration) => {
            if (declaration.kind === "Static") {
              return [`${declaration.property}: ${declaration.value}`];
            }
            const value = styleValue(declaration.property, declaration.value, scope);
            return value === undefined ? [] : [`${declaration.property}: ${value}`];
          });
          break;
        case "Spread": {
          const source = evaluate(attribute.value, scope, "a spread");
          if (source === null || source === undefined) break;
          if (typeof source !== "object") throw outside(attribute.value, "a spread of no object");
          for (const { name } of attribute.keys) {
            const value = (source as Record<string, unknown>)[name];
            if (name === "class") classes.push(...classTokens(attribute.value, value));
            else set(name, attributeValue(node.tag, name, namespace, value, attribute.value));
          }
          break;
        }
        // A listener and a template ref render nothing: they act in the browser (ADR-0047,
        // ADR-0049), which the corpus's behaviour layers check.
        case "Event":
        case "Ref":
          break;
        default:
          throw new Error(`unknown attribute ${(attribute satisfies never as Attribute).kind}`);
      }
    }
    // A token repeated at run time renders differently: Angular removes the repeat.
    if (new Set(classes).size !== classes.length) {
      throw new Error(`<${node.tag}> repeats a class: ${classes.join(" ")} (ADR-0035)`);
    }
    if (classes.length) set("class", classes.join(" "));
    if (style?.length) set("style", style.join("; "));
    return [...values].map(([name, value]) => createStaticAttribute(name, value, at));
  }
}

/**
 * The text an interpolation renders. A non-finite number is outside the contract wherever it
 * renders (ADR-0035): Astro's renderer drops `NaN`, React logs one alone, and no author means
 * to show one.
 */
function interpolated(expression: Expression, scope: Scope): string {
  const value = evaluate(expression, scope, "an interpolation");
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw outside(expression, `${value} rendered as text`);
    return String(value);
  }
  throw outside(expression, `${typeof value} rendered as text`);
}

/** What a bound attribute renders, or `undefined` for none. */
function boundValue(
  tag: string,
  name: string,
  namespace: Namespace,
  expression: Expression,
  scope: Scope,
): string | true | undefined {
  return attributeValue(
    tag,
    name,
    namespace,
    evaluate(expression, scope, "an attribute"),
    expression,
  );
}

/** Attributes whose booleans render as `"true"` and `"false"`, besides ARIA's (ADR-0037). */
const STRING_BOOLEAN_ATTRIBUTES = new Set(["contenteditable", "draggable", "spellcheck"]);

/** What an attribute renders for a value, or `undefined` for none (ADR-0037). */
function attributeValue(
  tag: string,
  name: string,
  namespace: Namespace,
  value: unknown,
  expression: Expression,
): string | true | undefined {
  if (value === null || value === undefined) return undefined;
  if (namespace === "html" && BINDABLE_BOOLEAN_ATTRIBUTES.has(name)) {
    if (typeof value !== "boolean") throw outside(expression, `${name} bound to ${typeof value}`);
    return value || undefined;
  }
  if (typeof value === "boolean") {
    if (name.startsWith("aria-") || STRING_BOOLEAN_ATTRIBUTES.has(name)) return String(value);
    throw outside(expression, `${name} bound to a boolean`);
  }
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw outside(expression, `${name} bound to ${value}`);
    text = String(value);
    // React drops a number its property refuses (`rows={0}`).
    const numeric = namespace === "html" ? NUMERIC_ATTRIBUTES.get(tag)?.get(name) : undefined;
    if (numeric && canonicalNumber(text, numeric) !== text) {
      throw outside(expression, `${name}={${text}} is out of its range`);
    }
  } else if (typeof value === "string") {
    text = value;
  } else {
    throw outside(expression, `${name} bound to ${typeof value}`);
  }
  if (URL_ATTRIBUTES.has(name)) {
    // React drops an empty URL and blocks `javascript:`; Angular prefixes the unsafe ones.
    if (text === "" || isJavaScriptUrl(text) || /^\s*data:/i.test(text)) {
      throw outside(expression, `${name}=${JSON.stringify(text)}`);
    }
  }
  return text;
}

/** The class names a dynamic part (or a spread's `class`) holds. */
function classTokens(expression: Expression, value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "string") throw outside(expression, `a class of ${typeof value}`);
  return tokens(value);
}

/** The names a class value holds, separated by ASCII whitespace. */
function tokens(value: string): string[] {
  return value.split(/[\t\n\f\r ]+/).filter((token) => token !== "");
}

/** What a bound style declaration renders, or `undefined` when it is left out. */
function styleValue(property: string, expression: Expression, scope: Scope): string | undefined {
  const value = evaluate(expression, scope, "a style value");
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    // React and Qwik add `px` to a number anywhere else.
    if (!UNITLESS_PROPERTIES.has(property) && !isCustomProperty(property)) {
      throw outside(expression, `${property}: ${value} without a unit`);
    }
    if (!Number.isFinite(value)) throw outside(expression, `${property}: ${value}`);
    return String(value);
  }
  if (typeof value !== "string") throw outside(expression, `${property} of ${typeof value}`);
  if (/[;]|!\s*important/i.test(value)) throw outside(expression, `${property}: ${value}`);
  return value.trim();
}

/** A value the contract leaves out: the case is wrong, not a target. */
function outside(expression: Expression, problem: string): Error {
  return new Error(
    `\`${expression.code}\` gives a value outside the contract (ADR-0035): ${problem}.`,
  );
}

const compiled = new Map<string, (...values: unknown[]) => unknown>();

/**
 * Evaluates an expression's code as JavaScript, with every name in scope as a parameter: the
 * names the source declares, not the references the analyser resolved. The allowed globals are
 * JavaScript's own.
 */
function evaluate(expression: Expression, scope: Scope, role: string): unknown {
  const names = [...scope.keys()];
  const key = `${names.join(",")}\n${expression.code}`;
  let run = compiled.get(key);
  if (!run) {
    // A line break before the closing parenthesis ends a trailing line comment.
    run = new Function(...names, `"use strict";\nreturn (\n${expression.code}\n);`) as (
      ...values: unknown[]
    ) => unknown;
    compiled.set(key, run);
  }
  try {
    return run(...scope.values());
  } catch (error) {
    throw new Error(`${role}, \`${expression.code}\`, throws: ${String(error)}`, { cause: error });
  }
}
