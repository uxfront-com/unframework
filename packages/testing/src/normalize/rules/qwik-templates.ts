import type { NormalizeTarget } from "../targets.ts";
import { childrenOf, isElement, replaceChildren } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Rule 2b: removes every `q:template` element, with its content, from Qwik's output (ADR-0058).
 * Qwik's server render keeps a slot's unclaimed fallback in one, hidden and `aria-hidden`, for
 * resumption (`addUnclaimedProjection`); it renders nowhere, and the client render does not have
 * it. Only Qwik writes it: the same element in another target's output stays.
 */
export function removeQwikTemplates(root: TreeParent, target?: NormalizeTarget): void {
  if (target !== "qwik") return;
  remove(root);
}

function remove(root: TreeParent): void {
  const children = childrenOf(root);
  const kept = children.filter((node) => !isElement(node) || node.tagName !== "q:template");
  if (kept.length !== children.length) replaceChildren(root, kept);
  for (const node of kept) {
    if (isElement(node)) remove(node);
  }
}
