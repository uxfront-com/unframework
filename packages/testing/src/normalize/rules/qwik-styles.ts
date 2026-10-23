import type { NormalizeTarget } from "../targets.ts";
import { childrenOf, getAttribute, isElement, replaceChildren } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Rule 2c: removes every `<style q:style>` element, with its content, from Qwik's output
 * (ADR-0063). A component's `useStyles$` sheet is written where the component renders by Qwik's
 * server render of a fragment, and in `<head>` by its client render, so the server HTML has an
 * element the client's markup does not. Only a `style` carrying Qwik's `q:style` goes: it runs
 * before rule 2 removes that attribute, and a `<style>` the source writes stays.
 */
export function removeQwikStyles(root: TreeParent, target?: NormalizeTarget): void {
  if (target !== "qwik") return;
  remove(root);
}

function remove(root: TreeParent): void {
  const children = childrenOf(root);
  const kept = children.filter(
    (node) =>
      !isElement(node) || node.tagName !== "style" || getAttribute(node, "q:style") === undefined,
  );
  if (kept.length !== children.length) replaceChildren(root, kept);
  for (const node of kept) {
    if (isElement(node)) remove(node);
  }
}
