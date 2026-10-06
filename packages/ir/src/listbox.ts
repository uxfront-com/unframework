// How HTML shows a `<select>`: as a drop-down, which selects an option as soon as it has one,
// or as a list box, which starts with none selected. One copy, so the `listbox` capability the
// compiler derives from the IR and the render-parity kit that holds the targets to it agree.

import type {
  BoundAttribute,
  ElementNode,
  RenderNode,
  SpreadAttribute,
  StaticAttribute,
} from "./types.ts";

/**
 * The attribute that sets the `size` of what may be a single-selection list box holding an
 * option a drop-down would select, or `undefined` for any other element: a `<select>` without a
 * static `multiple` whose display size can be above 1, read by HTML's rules for parsing
 * non-negative integers (browsers show 0 and 1 alike, as a drop-down). HTML builds a select with
 * its attributes before its options, so such a list box starts with no option selected, where a
 * drop-down selects its first option that is not disabled.
 *
 * What is known only at run time counts as a list box, so that a target that cannot render one
 * is never handed one unawares (ADR-0033): a bound `size`, or one a spread may set, is above 1
 * and a bound or spread `multiple` is absent; an option in a conditional or a list is there,
 * and a bound or spread `disabled` is not.
 */
export function listBoxSize(
  element: ElementNode,
): StaticAttribute | BoundAttribute | SpreadAttribute | undefined {
  if (element.tag !== "select" || hasStaticAttribute(element, "multiple")) return undefined;
  const size = sizeOf(element);
  if (!size) return undefined;
  if (size.kind === "Static") {
    if (size.value === true) return undefined;
    const displaySize = parseNonNegativeInteger(size.value);
    if (displaySize === undefined || displaySize <= 1) return undefined;
  }
  return hasSelectableOption(element, element.children) ? size : undefined;
}

/** The attribute that sets an element's `size`: a static or bound one, or a spread's key. */
function sizeOf(
  element: ElementNode,
): StaticAttribute | BoundAttribute | SpreadAttribute | undefined {
  for (const attribute of element.attributes) {
    if (attribute.kind === "Static" || attribute.kind === "Bound") {
      if (attribute.name === "size") return attribute;
    } else if (attribute.kind === "Spread" && attribute.keys.some(({ name }) => name === "size")) {
      return attribute;
    }
  }
  return undefined;
}

/** HTML's rules for parsing non-negative integers: `undefined` where they fail. */
function parseNonNegativeInteger(value: string): number | undefined {
  const match = /^[\t\n\f\r ]*([+-]?)(\d+)/.exec(value);
  if (!match) return undefined;
  const number = Number(match[2]);
  return match[1] === "-" && number !== 0 ? undefined : number;
}

/**
 * Whether a drop-down would select one of the options among `children` of `parent`: one that is
 * not disabled, by its own `disabled` or by its parent `<optgroup>`'s, as HTML decides. The
 * branches of a conditional and the body of a list count as the parent's children.
 */
function hasSelectableOption(parent: ElementNode, children: readonly RenderNode[]): boolean {
  return children.some((child) => {
    switch (child.kind) {
      case "Element":
        if (child.tag !== "option") return hasSelectableOption(child, child.children);
        return (
          !hasStaticAttribute(child, "disabled") &&
          !(parent.tag === "optgroup" && hasStaticAttribute(parent, "disabled"))
        );
      case "If":
        return child.branches.some((branch) => hasSelectableOption(parent, branch.children));
      case "For":
        return hasSelectableOption(parent, [child.body]);
      case "Text":
      case "Interpolation":
        return false;
      default:
        return unreachable(child);
    }
  });
}

/** Whether an element has a static attribute: present whatever happens at run time. */
function hasStaticAttribute(element: ElementNode, name: string): boolean {
  return element.attributes.some(
    (attribute) => attribute.kind === "Static" && attribute.name === name,
  );
}

function unreachable(value: never): never {
  throw new Error(`Unexpected render node: ${JSON.stringify(value)}`);
}
