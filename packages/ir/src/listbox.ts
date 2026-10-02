// How HTML shows a `<select>`: as a drop-down, which selects an option as soon as it has one,
// or as a list box, which starts with none selected. One copy, so the `listbox` capability the
// compiler derives from the IR and the render-parity kit that holds the targets to it agree.

import type { Attribute, ElementNode } from "./types.ts";

/**
 * The `size` attribute of a single-selection list box holding an option a drop-down would
 * select, or `undefined` for any other element: a `<select>` without `multiple` whose display
 * size, read by HTML's rules for parsing non-negative integers, is above 1 (browsers show 0 and
 * 1 alike, as a drop-down). HTML builds a select with its attributes before its options, so
 * such a list box starts with no option selected, where a drop-down selects its first option
 * that is not disabled.
 */
export function listBoxSize(element: ElementNode): Attribute | undefined {
  if (element.tag !== "select" || hasAttribute(element, "multiple")) return undefined;
  const size = element.attributes.find(({ name }) => name === "size");
  if (!size || size.value === true) return undefined;
  const displaySize = parseNonNegativeInteger(size.value);
  if (displaySize === undefined || displaySize <= 1) return undefined;
  return hasSelectableOption(element) ? size : undefined;
}

/** HTML's rules for parsing non-negative integers: `undefined` where they fail. */
function parseNonNegativeInteger(value: string): number | undefined {
  const match = /^[\t\n\f\r ]*([+-]?)(\d+)/.exec(value);
  if (!match) return undefined;
  const number = Number(match[2]);
  return match[1] === "-" && number !== 0 ? undefined : number;
}

/**
 * Whether a drop-down would select one of the options under `parent`: one that is not disabled,
 * by its own `disabled` or by its parent `<optgroup>`'s, as HTML decides.
 */
function hasSelectableOption(parent: ElementNode): boolean {
  return parent.children.some((child) => {
    if (child.kind !== "Element") return false;
    if (child.tag !== "option") return hasSelectableOption(child);
    return (
      !hasAttribute(child, "disabled") &&
      !(parent.tag === "optgroup" && hasAttribute(parent, "disabled"))
    );
  });
}

function hasAttribute(element: ElementNode, name: string): boolean {
  return element.attributes.some((attribute) => attribute.name === name);
}
