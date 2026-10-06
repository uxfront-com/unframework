import { parseStyle, printStyle, sortDeclarations } from "../style.ts";
import type { NormalizeTarget } from "../targets.ts";
import { attributeName, forEachElement, HTML_NAMESPACE } from "../tree.ts";
import type { TreeParent } from "../tree.ts";

/**
 * Rule 4a: rewrites every `style` attribute in the CSSOM's format (`a: b; c: d;`): comments and
 * spacing go and property names are lowercased (see `style.ts`). Then (ADR-0044, amending
 * ADR-0031), as frameworks disagree on these even with themselves:
 *
 * - a declaration with an empty value goes: the CSSOM ignores it, and Vue's server renders a
 *   bound empty or nullish value as `color:;` where its client sets nothing;
 * - the declarations are sorted by property name, unless the order of two of them decides what
 *   renders (the same property twice, a shorthand and its longhand, a flow-relative longhand and
 *   a physical one): then they keep their order (`sortDeclarations`). A client appends a
 *   declaration it sets again after removing it, and Angular applies its static `style` first;
 * - a `style` with no declaration left goes, as a style that declares nothing is no style:
 *   Vue's server writes `style=""` where its client writes none.
 *
 * An overridden declaration is kept, in its place. Only the browser knows whether the later one
 * is valid: if it is not, the earlier one is what renders (`color: red; color: nonsense` is red),
 * so dropping it would equate a fallback with its loss. The live DOM's `style.cssText` has
 * already been through the CSSOM, so the DOM path needs no such guess.
 */
export function canonicalizeStyles(root: TreeParent): void {
  forEachElement(root, (element) => {
    element.attrs = element.attrs.flatMap((attribute) => {
      if (attributeName(attribute) !== "style") return [attribute];
      const declarations = parseStyle(attribute.value).filter(
        (declaration) => declaration.value !== "",
      );
      if (!declarations.length) return [];
      attribute.value = printStyle(sortDeclarations(declarations));
      return [attribute];
    });
  });
}

/** Boolean attributes every HTML element can have. */
const GLOBAL_BOOLEAN_ATTRIBUTES: readonly string[] = ["autofocus", "hidden", "inert", "itemscope"];

/** Boolean attributes per HTML element, from the HTML standard's attribute index. */
const BOOLEAN_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  audio: ["autoplay", "controls", "loop", "muted"],
  button: ["disabled", "formnovalidate"],
  details: ["open"],
  dialog: ["open"],
  fieldset: ["disabled"],
  form: ["novalidate"],
  iframe: ["allowfullscreen"],
  img: ["ismap"],
  input: ["alpha", "checked", "disabled", "formnovalidate", "multiple", "readonly", "required"],
  link: ["disabled"],
  ol: ["reversed"],
  optgroup: ["disabled"],
  option: ["disabled", "selected"],
  script: ["async", "defer", "nomodule"],
  select: ["disabled", "multiple", "required"],
  template: [
    "shadowrootclonable",
    "shadowrootcustomelementregistry",
    "shadowrootdelegatesfocus",
    "shadowrootserializable",
  ],
  textarea: ["disabled", "readonly", "required"],
  track: ["default"],
  video: ["autoplay", "controls", "loop", "muted", "playsinline"],
};

/**
 * Rule 4b: writes every boolean attribute of an HTML element as `name=""`. The standard allows
 * the empty string or the attribute's own name, and frameworks pick either (`disabled`,
 * `disabled=""`, `disabled="disabled"`). Any other value (`disabled="false"`) is invalid HTML
 * that still switches the state on, so it is kept for the reader to see. `hidden="until-found"`
 * is a state of its own and stays too.
 *
 * Qwik's client is the one exception (ADR-0031: noise is per target): Qwik 2.0 beta writes a
 * boolean attribute that is on as `name="true"`, a constant one through `setAttribute(name,
 * true)` and a bound one too, but for the few whose DOM property has the same lower-case name,
 * where its server writes `name=""`. The IR only ever turns a boolean attribute on with `true`,
 * so on Qwik `"true"` is that, and only Qwik's `"true"` is rewritten.
 */
export function canonicalizeBooleanAttributes(root: TreeParent, target?: NormalizeTarget): void {
  forEachElement(root, (element) => {
    if (element.namespaceURI !== HTML_NAMESPACE) return;
    const own = BOOLEAN_ATTRIBUTES[element.tagName] ?? [];
    for (const attribute of element.attrs) {
      const name = attributeName(attribute);
      if (!GLOBAL_BOOLEAN_ATTRIBUTES.includes(name) && !own.includes(name)) continue;
      const value = attribute.value.toLowerCase();
      if (value === name || (target === "qwik" && value === "true")) attribute.value = "";
    }
  });
}
