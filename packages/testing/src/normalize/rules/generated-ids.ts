import { GENERATED_ID_PREFIX, replaceIdReferences } from "@unframework/ir";

import { attributeName, forEachElement } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Generated ids are recognised by where they come from, not by their shape: they carry the
 * prefix only the compiler writes (`GENERATED_ID_PREFIX`). Its id helper writes `uf-id-…` on
 * the targets without an id API (Angular, Astro).
 *
 * The frameworks' own formats are deliberately not recognised: Qwik's (`B2t0`) is any short
 * word, Svelte's (`s1`, `c2`) and Solid's (`cl-1`, `00`) are ordinary authored ids, and naming
 * them generated on one target renamed authored ids there alone, while the reference kept them.
 *
 * M2 (`useId`) must keep this provenance: the lowering emits the prefix in front of each
 * framework's id on every target (`"uf-id-" + useId()`). The analyzer reserves the prefix in
 * every reference this rule reads (`replaceIdReferences` of `@unframework/ir`, which both use),
 * rejecting authored ids and id references that start with it.
 */
export function isGeneratedId(id: string): boolean {
  return id.startsWith(GENERATED_ID_PREFIX);
}

/**
 * Rule 7: renames every generated id (see `isGeneratedId`) to `uf-id-1`, `uf-id-2`… in order of
 * first appearance (elements in document order, attributes in the element's order), the same
 * way everywhere it is referenced: in `id` and the idref attributes, in a `#id` URL and in
 * `url(#id)` (`replaceIdReferences`). References stay consistent and a broken association
 * still shows. Every other id is authored and stays exactly as it is.
 */
export function canonicalizeGeneratedIds(root: TreeParent): void {
  const names = new Map<string, string>();
  const rename = (id: string) => {
    if (!isGeneratedId(id)) return id;
    let name = names.get(id);
    if (name === undefined) {
      name = `${GENERATED_ID_PREFIX}${names.size + 1}`;
      names.set(id, name);
    }
    return name;
  };
  forEachElement(root, (element) => {
    for (const attribute of element.attrs) {
      attribute.value = replaceIdReferences(attributeName(attribute), attribute.value, rename);
    }
  });
}
