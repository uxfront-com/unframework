import type { NormalizeTarget } from "../targets.ts";
import {
  attributeName,
  childrenOf,
  forEachElement,
  getAttribute,
  HTML_NAMESPACE,
  isText,
  replaceChildren,
} from "../tree.ts";
import type { TreeElement, TreeParent } from "../tree.ts";

/**
 * Rule 4d: removes the markup of a form control's initial state where its live state, a `uf:*`
 * pseudo-attribute, says the same (ADR-0058):
 * - an `<input>`'s `value` attribute that equals its `uf:value`;
 * - an `<input>`'s `checked` attribute where its `uf:checked` is `"true"`;
 * - an `<option>`'s `selected` attribute where its `uf:selected` is `"true"`;
 * - a `<textarea>`'s text that equals its `uf:value`.
 *
 * Vue's `v-model` sets only the property, where react-dom keeps a controlled input's attribute
 * in step with its value and writes `defaultChecked` and `defaultValue` as markup, and Astro,
 * which runs no client code, writes the initial state as markup alone: the state compares in
 * `uf:*` on every target, so the markup only repeats it. Markup that differs (a static
 * `value="x"` after the person typed `y`, a `checked` box the person cleared) stays, and so does
 * the markup of an element without the `uf:*` state (a server render). It holds for every
 * target, the reference included: a static field's attribute, which React writes as
 * `defaultValue` and Vue as the attribute, must still compare before anyone acts.
 */
export function removeSettledValues(root: TreeParent): void {
  forEachElement(root, (element) => {
    if (element.namespaceURI !== HTML_NAMESPACE) return;
    switch (element.tagName) {
      case "input": {
        const state = getAttribute(element, "uf:value");
        if (state !== undefined && getAttribute(element, "value") === state) {
          removeAttribute(element, "value");
        }
        if (getAttribute(element, "uf:checked") === "true") removeAttribute(element, "checked");
        return;
      }
      case "option":
        if (getAttribute(element, "uf:selected") === "true") removeAttribute(element, "selected");
        return;
      case "textarea": {
        const state = getAttribute(element, "uf:value");
        const children = childrenOf(element);
        const text = children.every(isText)
          ? children.map((child) => child.value).join("")
          : undefined;
        if (state !== undefined && children.length && text === state) replaceChildren(element, []);
        return;
      }
      default:
        return;
    }
  });
}

/**
 * Rule 4e: on React only, removes a `checked` or `selected` attribute wherever the element's
 * `uf:checked` or `uf:selected` state is there, whatever that state says (ADR-0060). react-dom
 * writes a controlled box's or option's first state as its attribute and never updates it, so
 * the attribute of a box the person cleared shows a state that is gone; the live state compares
 * in `uf:*`, which a real difference (a box still checked) still changes. Rule 4d keeps such an
 * attribute on every other target, where only the markup the source wrote puts it there. An
 * element without the `uf:*` state (a server render) keeps its attribute on React too.
 */
export function removeReactDefaultStates(root: TreeParent, target?: NormalizeTarget): void {
  if (target !== "react") return;
  forEachElement(root, (element) => {
    if (element.namespaceURI !== HTML_NAMESPACE) return;
    if (element.tagName === "input" && getAttribute(element, "uf:checked") !== undefined) {
      removeAttribute(element, "checked");
    } else if (element.tagName === "option" && getAttribute(element, "uf:selected") !== undefined) {
      removeAttribute(element, "selected");
    }
  });
}

/**
 * Rule 4f: in a hydrated tree only (L12, ADR-0095), removes the markup of a form control's state
 * wherever its live state, a `uf:*` pseudo-attribute, is there, whatever either says: an
 * `<input>`'s `value` and `checked`, an `<option>`'s `selected` and a `<textarea>`'s text. The
 * server writes a bound control's first state as markup, which hydration keeps and no client
 * updates, where a client render of the same component writes only the property (Vue's
 * `v-model`): after the person types, the markup shows a state that is gone. The live state
 * compares in `uf:*`, and the markup is checked where it is written: in the server's HTML (L6)
 * and in the client render's DOM (L7).
 */
export function removeServerControlStates(root: TreeParent, hydrated?: boolean): void {
  if (!hydrated) return;
  forEachElement(root, (element) => {
    if (element.namespaceURI !== HTML_NAMESPACE) return;
    switch (element.tagName) {
      case "input":
        if (getAttribute(element, "uf:value") !== undefined) removeAttribute(element, "value");
        if (getAttribute(element, "uf:checked") !== undefined) removeAttribute(element, "checked");
        return;
      case "option":
        if (getAttribute(element, "uf:selected") !== undefined) {
          removeAttribute(element, "selected");
        }
        return;
      case "textarea":
        if (getAttribute(element, "uf:value") !== undefined) replaceChildren(element, []);
        return;
      default:
        return;
    }
  });
}

function removeAttribute(element: TreeElement, name: string): void {
  element.attrs = element.attrs.filter((attribute) => attributeName(attribute) !== name);
}
