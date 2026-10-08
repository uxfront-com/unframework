import { attributeName, forEachElement, getAttribute, HTML_NAMESPACE } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Rule 4d: removes an `<input>`'s `value` attribute when it equals the input's current value,
 * its `uf:value` (ADR-0058). react-dom keeps a controlled input's attribute in step with its
 * value, and Vue's `v-model` sets only the property: the state compares in `uf:value` on every
 * target, so the attribute only repeats it. One that differs (a static `value="x"` after the
 * person typed `y`) stays, and so does every `value` of an element without `uf:value`. It holds
 * for every target, the reference included: a static field's attribute, which React writes as
 * `defaultValue` and Vue as the attribute, must still compare before anyone types.
 */
export function removeSettledValues(root: TreeParent): void {
  forEachElement(root, (element) => {
    if (element.namespaceURI !== HTML_NAMESPACE || element.tagName !== "input") return;
    const state = getAttribute(element, "uf:value");
    if (state === undefined || getAttribute(element, "value") !== state) return;
    element.attrs = element.attrs.filter((attribute) => attributeName(attribute) !== "value");
  });
}
