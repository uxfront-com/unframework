import type { NormalizeTarget } from "../targets.ts";
import { attributeName, childrenOf, isElement, replaceChildren } from "../tree.ts";
import type { TreeElement, TreeParent } from "../tree.ts";
import { isFrameworkAttribute } from "./framework-attributes.ts";

/**
 * Rule 2b: removes every `q:template` element, with its content, from Qwik's output (ADR-0058).
 * Qwik's server render keeps a slot's unclaimed fallback in one, hidden and `aria-hidden`, for
 * resumption (`addUnclaimedProjection`); it renders nowhere, and the client render does not have
 * it. Only Qwik writes it: the same element in another target's output stays. So is a visible
 * task's placeholder (`isTaskPlaceholder`).
 */
export function removeQwikTemplates(root: TreeParent, target?: NormalizeTarget): void {
  if (target !== "qwik") {
    return;
  }
  remove(root);
}

/**
 * Whether an element is Qwik's placeholder for a component that renders no element of its own
 * (ADR-0098): an empty `<script hidden>` whose other attributes are all Qwik's own, where its
 * server render writes the listener of the component's visible task. Rule 2 has removed those
 * by now, so it holds `hidden` alone. It renders nothing, and the client render, which runs the
 * task in place, does not have it.
 */
function isTaskPlaceholder(node: TreeElement): boolean {
  return (
    node.tagName === "script" &&
    childrenOf(node).length === 0 &&
    node.attrs.some((attribute) => attributeName(attribute) === "hidden") &&
    node.attrs.every((attribute) => {
      const name = attributeName(attribute);
      return name === "hidden" || isFrameworkAttribute(name, "qwik");
    })
  );
}

function remove(root: TreeParent): void {
  const children = childrenOf(root);
  const kept = children.filter(
    (node) => !isElement(node) || (node.tagName !== "q:template" && !isTaskPlaceholder(node)),
  );
  if (kept.length !== children.length) {
    replaceChildren(root, kept);
  }
  for (const node of kept) {
    if (isElement(node)) {
      remove(node);
    }
  }
}
