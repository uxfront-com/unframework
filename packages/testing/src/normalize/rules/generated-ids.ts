import { GENERATED_ID_PREFIX } from "@unframework/ir";

import { attributeName, childrenOf, isElement, isText } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Generated ids are recognised by where they come from, not by their shape: they carry the
 * prefix only the compiler writes (`GENERATED_ID_PREFIX`), in front of each framework's id on
 * every target (`"uf-id-" + useId()`, ADR-0049), and the analyzer rejects an authored id or id
 * reference that starts with it (UF3005). The frameworks' own formats are deliberately not
 * recognised: Qwik's (`B2t0`) is any short word, Svelte's (`s1`, `c2`) and Solid's (`cl-1`,
 * `00`) are ordinary authored ids, and naming them generated on one target renamed authored ids
 * there alone, while the reference kept them.
 *
 * A generated id stands wherever it appears in a value or a text: the prefix, then the
 * characters the frameworks' ids are made of (Vue's `v-0`, React's `_R_2_` and `_r_1_`,
 * Svelte's `s1`, Solid's `cl-1`, Qwik's `B2t0`, Angular's and Astro's `name-0`), not preceded by
 * one of them. So an id ends where an id character stops (`uf-id-v-0.` is the id and a full
 * stop, as are `#uf-id-v-0` and `url(#uf-id-v-0)` around it), and an author's suffix
 * (`${id}-${index}`) makes another id, numbered on its own: two ids a follower makes equal and
 * the reference does not still read apart. An id with another character (a future format) is
 * not renamed whole, and fails parity loudly.
 */
const GENERATED_ID: RegExp = new RegExp(`(?<![\\w-])${GENERATED_ID_PREFIX}[\\w-]+`, "g");

/**
 * Renames the generated ids in a text (an attribute value, a text node, an ARIA snapshot, a
 * payload's string) to `uf-id-1`, `uf-id-2`… in order of first appearance, continuing the
 * renaming `names` holds and adding to it.
 */
export function renameGeneratedIds(text: string, names: Map<string, string>): string {
  return text.replace(GENERATED_ID, (id) => {
    let name = names.get(id);
    if (name === undefined) {
      name = `${GENERATED_ID_PREFIX}${names.size + 1}`;
      names.set(id, name);
    }
    return name;
  });
}

/** ASCII whitespace, which separates the tokens of a `class` attribute. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

/** Compares by UTF-16 code units, as rule 4c sorts a `class`'s tokens. */
const byCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Rule 7: renames every generated id (see `GENERATED_ID`) to `uf-id-1`, `uf-id-2`… in order of
 * first appearance, the same way wherever it appears (ADR-0049): in every attribute value (`id`,
 * the idref attributes, a `#id` URL, `url(#id)`, a radio group's `name`, a `data-*` value) and
 * in every text node, elements in document order, each element's attributes (in the order
 * `sortAttributes` leaves) before its children. References stay consistent and a broken
 * association still shows. A `class`'s tokens, which carry no order, are sorted again once
 * renamed. Every other id is authored and stays exactly as it is. Returns the renaming, from
 * each original id to its new name (`names`, when given, is filled in): a trace renames the ids
 * a step's ARIA tree and emitted payloads carry with it, as its DOM's.
 */
export function canonicalizeGeneratedIds(
  root: TreeParent,
  names: Map<string, string> = new Map(),
): Map<string, string> {
  for (const node of childrenOf(root)) {
    if (isElement(node)) {
      for (const attribute of node.attrs) {
        const value = renameGeneratedIds(attribute.value, names);
        attribute.value =
          attributeName(attribute) === "class" && value !== attribute.value
            ? value.split(ASCII_WHITESPACE).toSorted(byCodeUnits).join(" ")
            : value;
      }
      canonicalizeGeneratedIds(node, names);
    } else if (isText(node)) {
      node.value = renameGeneratedIds(node.value, names);
    }
  }
  return names;
}
