import { attributeName, forEachElement } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/** Compares by UTF-16 code units, so the order never depends on a locale. */
const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Rule 5: sorts every element's attributes by name. Attribute order carries no meaning, and
 * each framework writes them in its own order (React and Solid follow props, Qwik puts `:`
 * first, Vue moves `class` and `style`). It runs before ids are numbered (rule 7), so the
 * numbering never depends on a framework's attribute order.
 */
export function sortAttributes(root: TreeParent): void {
  forEachElement(root, (element) => {
    element.attrs = element.attrs.toSorted((a, b) =>
      byCodeUnits(attributeName(a), attributeName(b)),
    );
  });
}

/** ASCII whitespace, which separates the tokens of a `class` attribute. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

/**
 * Rule 4c: sorts the tokens of every `class` attribute and joins them with one space. Token
 * order and spacing carry no meaning. Duplicate tokens are kept: a doubled class usually means
 * a merge went wrong. An empty `class=""` stays, as it still matches `[class]`.
 */
export function canonicalizeClasses(root: TreeParent): void {
  forEachElement(root, (element) => {
    for (const attribute of element.attrs) {
      if (attributeName(attribute) !== "class") continue;
      attribute.value = attribute.value
        .split(ASCII_WHITESPACE)
        .filter((token) => token !== "")
        .toSorted(byCodeUnits)
        .join(" ");
    }
  });
}
