// A conditional's branches as distinct elements (ADR-0036): the IR's branches render as `v-if`'s
// do, each its own DOM, so switching branches replaces the element and anything the user did to
// it (focus, a field's text, a typed value, an open `<details>`) goes with it. React reuses an
// element of the same type that it reconciles with another branch's instead: at the conditional's
// place, position by position in two fragments there, and against the first of several roots
// where the conditional is its parent's only child (React unwraps an unkeyed fragment there).
// Where two branches can render an element of one tag at their top (through fragments, nested
// conditionals and lists) and a branch holds such state (a control, a focusable element, a
// listener or a template ref, at any depth), every branch takes a key of its own, so React never
// reconciles one with another: a single root element its own `key`, anything else a keyed
// `Fragment`, and a nested conditional that is a branch's only root keys its own branches under
// that branch's key, as the ternary chain it prints in. Branches of text and markup alone stay
// unkeyed: React's reuse of them is not observable.
import {
  js,
  jsxAttributeValue,
  jsxBranch,
  jsxChildren,
  jsxElement,
  jsxExpression,
} from "@unframework/codegen";
import type { ImportSet, JsxContext } from "@unframework/codegen";
import type { ElementNode, IfBranch, IfNode, RenderNode } from "@unframework/ir";

type Expression =
  | ReturnType<typeof js.nullLiteral>
  | ReturnType<typeof jsxBranch>
  | ReturnType<typeof js.jsxElement>;

/**
 * A conditional as a ternary chain ending in `null` (codegen's `ternaryChain`), with a key on each
 * branch where React could otherwise reconcile one branch's element with another's.
 */
export function keyedTernary(node: IfNode, context: JsxContext, imports: ImportSet): Expression {
  // A conditional that is a keyed branch's only root renders where the other branches' elements
  // do: each of its own branches takes a key, whether or not they conflict among themselves.
  const keyed = KEYED.has(node) || conflicts(node);
  const prefix = PREFIXES.get(node) ?? "";
  const branch = (entry: IfBranch, index: number): Expression => {
    const [only] = entry.children;
    const single = entry.children.length === 1;
    if (single && only?.kind === "If") {
      // A nested conditional that is the branch's only root prints in this chain: its keys carry
      // this branch's (`key="1.0"`), so none equals another branch's.
      PREFIXES.set(only, `${prefix}${index}.`);
      if (keyed) KEYED.add(only);
    } else {
      placeConditionals(entry.children);
    }
    // Text alone is never reconciled with an element: it needs no key.
    if (!keyed || !only || (single && only.kind !== "Element" && only.kind !== "For")) {
      return jsxBranch(entry.children, context);
    }
    if (single && only.kind === "Element") {
      return jsxElement(only, context, [key(prefix, `${index}`)]);
    }
    // Several roots, or a list, whose rows React reconciles by their own keys: a keyed fragment.
    return js.jsxElement(
      imports.add("react", "Fragment"),
      [key(prefix, `${index}`)],
      jsxChildren(entry.children, context),
    );
  };
  const branches = [...node.branches.entries()];
  const last = branches.at(-1);
  let chain: Expression = js.nullLiteral();
  if (last && !last[1].condition) {
    chain = branch(last[1], last[0]);
    branches.pop();
  }
  for (const [index, entry] of branches.toReversed()) {
    chain = js.conditionalExpression(
      jsxExpression(entry.condition!, context, "test"),
      branch(entry, index),
      chain,
    );
  }
  return chain;
}

/**
 * Gives the keyed conditionals among one parent's children keys no sibling shares: where two or
 * more are keyed, each key starts with its conditional's position (`key="2-0"`), as React warns
 * about two children with one key and reconciles them by it. Call it on the children a parent
 * prints (an element's, the root fragment's), before they print.
 */
export function placeConditionals(children: readonly RenderNode[]): void {
  const keyed = children.flatMap((child, position) =>
    child.kind === "If" && conflicts(child) ? [[child, position] as const] : [],
  );
  if (keyed.length < 2) return;
  for (const [child, position] of keyed) PREFIXES.set(child, `${position}-`);
}

/**
 * The key prefix of a conditional: the enclosing chain's branch (`"1."`) for one that is a
 * branch's only root, or its position (`"2-"`) among keyed siblings. Set before it prints.
 */
const PREFIXES = new WeakMap<IfNode, string>();

/** The conditionals that are a keyed branch's only root: every branch they render is keyed. */
const KEYED = new WeakSet<IfNode>();

/** `key={index}`, or `key="prefix" + index` under a prefix (`key="1.0"`, `key="2-0"`). */
function key(prefix: string, value: string) {
  return js.jsxAttribute(
    "key",
    prefix
      ? jsxAttributeValue(`${prefix}${value}`)
      : js.jsxExpressionContainer(js.numberLiteral(Number(value))),
  );
}

/** Elements whose DOM holds what a user does to them: a control, a link, media, an open state. */
const STATEFUL = new Set([
  "a",
  "audio",
  "button",
  "details",
  "dialog",
  "embed",
  "iframe",
  "input",
  "object",
  "select",
  "summary",
  "textarea",
  "video",
]);

/**
 * Whether a node's DOM can hold state React would carry into another branch: a stateful
 * element, or an element that is focusable, editable, listened to or referenced, at any depth.
 */
function holdsState(node: RenderNode): boolean {
  switch (node.kind) {
    case "Element":
      return statefulElement(node) || node.children.some(holdsState);
    case "If":
      return node.branches.some((branch) => branch.children.some(holdsState));
    case "For":
      return holdsState(node.body);
    case "Text":
    case "Interpolation":
      return false;
    default:
      return node satisfies never;
  }
}

function statefulElement(element: ElementNode): boolean {
  return (
    STATEFUL.has(element.tag) ||
    element.attributes.some((attribute) => {
      switch (attribute.kind) {
        case "Event":
        case "Ref":
          return true;
        case "Static":
        case "Bound":
          return attribute.name === "tabindex" || attribute.name === "contenteditable";
        case "Class":
        case "Style":
        case "Spread":
          return false;
        default:
          return attribute satisfies never;
      }
    })
  );
}

/**
 * Whether React could reconcile an element of one branch with another's: a branch holds state,
 * and two branches can render an element of one tag at their top. Positions are not compared:
 * React matches a single root against the first of several where it unwraps a fragment, and a
 * keyed branch is never wrong, so a shared tag anywhere at the top is enough.
 */
function conflicts(node: IfNode): boolean {
  const { branches } = node;
  if (!branches.some((branch) => branch.children.some(holdsState))) return false;
  const tags = branches.map((branch) => topTags(branch.children));
  return tags.some((own, a) =>
    tags.some((other, b) => a < b && [...own].some((tag) => other.has(tag))),
  );
}

/**
 * The tags of the elements nodes can render at their top, where React reconciles them: their own
 * elements, those their nested conditionals' branches render there, and a list's rows.
 */
function topTags(nodes: readonly RenderNode[]): Set<string> {
  const tags = new Set<string>();
  for (const node of nodes) {
    switch (node.kind) {
      case "Element":
        tags.add(node.tag);
        break;
      case "If":
        for (const branch of node.branches) {
          for (const tag of topTags(branch.children)) tags.add(tag);
        }
        break;
      case "For":
        tags.add(node.body.tag);
        break;
      case "Text":
      case "Interpolation":
        break;
      default:
        node satisfies never;
    }
  }
  return tags;
}
