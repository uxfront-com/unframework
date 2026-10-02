import { childrenOf, isElement, replaceChildren } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Rule 1: removes every comment. Comments are never rendered, and every framework uses them as
 * anchors in its own way: Vue `<!--v-if-->` and `<!--[-->…<!--]-->`, Svelte `<!--[-->…<!--]-->`
 * and `<!---->`, Solid `<!--$-->`/`<!--/-->`, React `<!-- -->` between adjacent texts, Angular
 * `<!--container-->` and `<!--nghm-->`, Qwik `<!--qv …-->`. The text on either side of a removed
 * comment is left as it is, so it joins up exactly as it renders.
 */
export function removeComments(root: TreeParent): void {
  const children = childrenOf(root);
  if (children.some((node) => node.nodeName === "#comment")) {
    replaceChildren(
      root,
      children.filter((node) => node.nodeName !== "#comment"),
    );
  }
  for (const node of childrenOf(root)) {
    if (isElement(node)) removeComments(node);
  }
}
