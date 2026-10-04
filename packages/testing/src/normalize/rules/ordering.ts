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
 * a merge went wrong. A `class` with no token goes (ADR-0044, amending ADR-0031): frameworks
 * disagree even with themselves on writing an empty one (Vue's server writes `class=""` where
 * its client writes none, Svelte's client the other way round, and Chromium keeps
 * `class=""` once the last token is toggled off), and it applies no class: only a `[class]`
 * selector tells the two apart.
 */
export function canonicalizeClasses(root: TreeParent): void {
  forEachElement(root, (element) => {
    element.attrs = element.attrs.flatMap((attribute) => {
      if (attributeName(attribute) !== "class") return [attribute];
      const tokens = attribute.value.split(ASCII_WHITESPACE).filter((token) => token !== "");
      if (!tokens.length) return [];
      attribute.value = tokens.toSorted(byCodeUnits).join(" ");
      return [attribute];
    });
  });
}
