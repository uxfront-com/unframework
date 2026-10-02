import { dedupeDeclarations, parseStyle } from "../style.ts";
import type { NormalizeTarget } from "../targets.ts";
import { attributeName, childrenOf, HTML_NAMESPACE, isElement, replaceChildren } from "../tree.ts";
import type { TreeChild, TreeElement, TreeParent } from "../tree.ts";
import { isFrameworkAttribute } from "./framework-attributes.ts";

/**
 * Whether an element is the host of an Angular component under D6: an element selector
 * `uf-<name>` whose only styling is `display: contents`, so it renders no box. A host that
 * carries anything else (an authored or fallthrough attribute, another declaration) is not
 * unwrapped, so the difference it makes stays visible.
 */
export function isAngularHost(element: TreeElement): boolean {
  if (element.namespaceURI !== HTML_NAMESPACE || !element.tagName.startsWith("uf-")) return false;
  let contents = false;
  for (const attribute of element.attrs) {
    const name = attributeName(attribute);
    if (name === "style") {
      const declarations = dedupeDeclarations(parseStyle(attribute.value));
      contents =
        declarations.length === 1 &&
        declarations[0]!.property === "display" &&
        declarations[0]!.value?.toLowerCase() === "contents";
      if (!contents) return false;
    } else if (!isFrameworkAttribute(name, "angular")) {
      return false;
    }
  }
  return contents;
}

/**
 * Rule 3: replaces every Angular host element (see `isAngularHost`) in Angular's output with its
 * children. A `display: contents` host renders no box, so its children lay out as the other
 * targets' do; nested hosts are unwrapped too. Only Angular emits hosts (D6): the same wrapper
 * in another target's output is a real element that selectors and child indices see, so it
 * stays.
 */
export function unwrapAngularHosts(root: TreeParent, target?: NormalizeTarget): void {
  if (target !== "angular") return;
  unwrap(root);
}

function unwrap(root: TreeParent): void {
  const children = childrenOf(root);
  const unwrapped: TreeChild[] = [];
  let changed = false;
  for (const node of children) {
    if (!isElement(node)) {
      unwrapped.push(node);
      continue;
    }
    unwrap(node);
    if (isAngularHost(node)) {
      unwrapped.push(...childrenOf(node));
      changed = true;
    } else {
      unwrapped.push(node);
    }
  }
  if (changed) replaceChildren(root, unwrapped);
}
