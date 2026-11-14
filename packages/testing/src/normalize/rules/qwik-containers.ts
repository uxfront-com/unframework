import type { NormalizeTarget } from "../targets.ts";
import { childrenOf, getAttribute, isElement, isText, replaceChildren } from "../tree.ts";
import type { TreeChild, TreeElement, TreeParent } from "../tree.ts";

/** The element Qwik's server renderer wraps a component in (`target-qwik`'s `CONTAINER_TAG`). */
const CONTAINER_TAG = "uf-qwik-container";

/** The body of the event registration Qwik writes for its loader, in its container. */
const EVENT_REGISTRATION = /^\(window\._qwikEv\|\|\(window\._qwikEv=\[\]\)\)\.push\(/;

/**
 * Rule 2d: unwraps the container a resumed Qwik component sits in, and removes the scripts Qwik
 * writes into it for resumption (L12, ADR-0095): its state, vnode data and back-patches
 * (`type="qwik/…"`), its sync functions (`q:func`) and its loader's event registrations. A hydrate
 * project resumes the server's whole container, where a client render puts the component in the
 * mount root itself, which is the container there. Only Qwik writes them: the same elements in
 * another target's output stay, and so does any other `<script>` in Qwik's.
 */
export function unwrapQwikContainers(root: TreeParent, target?: NormalizeTarget): void {
  if (target !== "qwik") return;
  unwrap(root);
}

function unwrap(root: TreeParent): void {
  const children = childrenOf(root);
  const next: TreeChild[] = [];
  let changed = false;
  for (const node of children) {
    if (isElement(node) && node.tagName === CONTAINER_TAG) {
      changed = true;
      next.push(...childrenOf(node).filter((child) => !isContainerScript(child)));
    } else {
      next.push(node);
    }
  }
  if (changed) replaceChildren(root, next);
  for (const node of next) {
    if (isElement(node)) unwrap(node);
  }
}

function isContainerScript(node: TreeChild): boolean {
  if (!isElement(node) || node.tagName !== "script") return false;
  const type = getAttribute(node, "type");
  if (type?.startsWith("qwik/") || getAttribute(node, "q:func") !== undefined) return true;
  return EVENT_REGISTRATION.test(scriptText(node));
}

function scriptText(script: TreeElement): string {
  return childrenOf(script)
    .map((child) => (isText(child) ? child.value : ""))
    .join("");
}
