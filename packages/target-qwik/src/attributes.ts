import { isNumberTypedAttribute } from "@unframework/codegen";
import type { ElementNode, FragmentNode, RenderNode } from "@unframework/ir";

/**
 * HTML attribute names that Qwik 2's JSX types only accept in camel case (`tabIndex`,
 * `colSpan`). The DOM is the same either way: HTML attribute names are case-insensitive, so
 * Qwik's `setAttribute` and the HTML parser reading its server output both store `tabindex`.
 * The lower-case spelling fails type-checking (L4). Read from the `QwikIntrinsicElements` of
 * @qwik.dev/core 2.0.0-beta.47; test/attributes.test.ts type-checks every attribute the
 * authoring types accept, so a missing entry or a Qwik upgrade that changes one fails loudly.
 *
 * `autocorrect` is here for its value: Qwik types the HTML name by the DOM property, a
 * boolean, and `autoCorrect` as the string HTML means (`"on"`, `"off"`).
 *
 * Qwik also types some values narrower than HTML, which {@link qwikStaticValue} writes as Qwik
 * wants them: numbers and the enumerated `spellcheck` and `draggable`. What it declares no name
 * for at all is {@link QWIK_UNTYPED_ATTRIBUTES}.
 */
export const QWIK_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  accesskey: "accessKey",
  allowfullscreen: "allowFullscreen",
  autocorrect: "autoCorrect",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  colspan: "colSpan",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  datetime: "dateTime",
  disablepictureinpicture: "disablePictureInPicture",
  disableremoteplayback: "disableRemotePlayback",
  enterkeyhint: "enterKeyHint",
  fetchpriority: "fetchPriority",
  formaction: "formAction",
  formenctype: "formEnctype",
  formmethod: "formMethod",
  formnovalidate: "formNoValidate",
  formtarget: "formTarget",
  frameborder: "frameBorder",
  inputmode: "inputMode",
  itemid: "itemID",
  itemprop: "itemProp",
  itemref: "itemRef",
  itemscope: "itemScope",
  itemtype: "itemType",
  marginheight: "marginHeight",
  marginwidth: "marginWidth",
  maxlength: "maxLength",
  minlength: "minLength",
  nomodule: "noModule",
  novalidate: "noValidate",
  playsinline: "playsInline",
  readonly: "readOnly",
  referrerpolicy: "referrerPolicy",
  rowspan: "rowSpan",
  tabindex: "tabIndex",
  usemap: "useMap",
};

/**
 * The boolean attributes Qwik's JSX types as `boolean`, which reject a string. HTML means the
 * same by any value of one (`disabled`, `disabled=""`, `disabled="false"`), so each is written
 * bare: the client renderer then stores `="true"` and the server renderer an empty value, which
 * mean the same. Any other attribute written without a value becomes `=""`, because there
 * `true` would be a real difference (`"true"` on the client).
 */
export const QWIK_BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  "allowfullscreen",
  "alpha",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "disablepictureinpicture",
  "disableremoteplayback",
  "formnovalidate",
  "hidden",
  "inert",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
  "shadowrootclonable",
  "shadowrootcustomelementregistry",
  "shadowrootdelegatesfocus",
  "shadowrootserializable",
]);

/** Some elements by name, or every element but some. */
type Elements = { readonly on: readonly string[] } | { readonly except: readonly string[] };

/**
 * HTML attributes the analyser accepts that Qwik 2.0.0-beta.47's JSX types declare under no
 * name on some elements: their DOM property is read-only (`<input form>`, `<input list>`), or
 * Qwik declares it on a few elements only (`enterkeyhint`). Qwik
 * renders them as written, so the target writes each as an object spread, whose keys TypeScript
 * does not check against the element's (`<input {...{ list: "colours" }} />`). Pinned by
 * test/attributes.test.ts, which type-checks every attribute the analyser accepts.
 */
export const QWIK_UNTYPED_ATTRIBUTES: Readonly<Record<string, Elements>> = {
  enterkeyhint: { except: ["input", "textarea"] },
  form: { on: ["input"] },
  list: { on: ["input"] },
};

/**
 * The `contenteditable` values Qwik's types take under `contentEditable`, which are also all a
 * bound value can be (the analyser's enumerated tokens, ADR-0037). A static value they leave
 * out (`"plaintext-only"`) is written under the HTML name, as an object spread too.
 */
const QWIK_CONTENT_EDITABLE: ReadonlySet<string> = new Set(["false", "inherit", "true"]);

/**
 * Whether the target writes an attribute as an object spread under its HTML name (see
 * {@link QWIK_UNTYPED_ATTRIBUTES} and {@link QWIK_CONTENT_EDITABLE}): `value` is a static value,
 * or `undefined` for a bound one.
 */
export function isUntypedAttribute(
  tag: string,
  namespace: Namespace,
  name: string,
  value?: string | true,
): boolean {
  if (namespace !== "html") return false;
  const html = name.toLowerCase();
  if (html === "contenteditable") {
    return typeof value === "string" && !QWIK_CONTENT_EDITABLE.has(value);
  }
  const elements = QWIK_UNTYPED_ATTRIBUTES[html];
  if (!elements) return false;
  return "on" in elements ? elements.on.includes(tag) : !elements.except.includes(tag);
}

/** Where an element is: HTML, or a foreign subtree whose attribute names are case-sensitive. */
export type Namespace = "html" | "svg" | "math";

/**
 * The namespace of every element of a render tree: `<svg>` and `<math>` start a foreign
 * subtree, and a `<foreignObject>` returns its children to HTML. Only HTML elements take
 * Qwik's camel-cased attribute names: SVG and MathML keep theirs.
 */
export function elementNamespaces(root: ElementNode | FragmentNode): Map<ElementNode, Namespace> {
  const namespaces = new Map<ElementNode, Namespace>();
  const visit = (node: RenderNode | FragmentNode, parent: Namespace): void => {
    switch (node.kind) {
      case "Element": {
        const namespace =
          parent === "html" && (node.tag === "svg" || node.tag === "math") ? node.tag : parent;
        namespaces.set(node, namespace);
        const inner = namespace === "svg" && node.tag === "foreignObject" ? "html" : namespace;
        for (const child of node.children) visit(child, inner);
        return;
      }
      case "Fragment":
        for (const child of node.children) visit(child, parent);
        return;
      case "If":
        for (const branch of node.branches) {
          for (const child of branch.children) visit(child, parent);
        }
        return;
      case "For":
        visit(node.body, parent);
        return;
      case "Text":
      case "Interpolation":
        return;
      default:
        return node satisfies never;
    }
  };
  visit(root, "html");
  return namespaces;
}

/**
 * The name Qwik's JSX types declare for an attribute: HTML names are case-insensitive, so
 * `readOnly` in the source is `readonly`, which Qwik spells `readOnly` again.
 */
export function qwikAttributeName(name: string, namespace: Namespace): string {
  return namespace === "html" ? (QWIK_ATTRIBUTE_NAMES[name.toLowerCase()] ?? name) : name;
}

/**
 * A static value as Qwik's types take it (design §5.6): `true` to write the attribute bare, a
 * string to write it quoted, or `{ code }` to write that expression.
 *
 * - A boolean attribute is bare whatever its value, except `hidden="until-found"`, a state of
 *   its own that Qwik's types accept; any other attribute without a value is empty, because
 *   Qwik's client renderer writes `true` as `"true"`.
 * - An attribute Qwik or React types as a number (`tabindex`, `colspan`, `aria-level`…) is a
 *   number literal: the IR holds it in canonical form (ADR-0037), which Qwik's `String()`
 *   writes back the same.
 * - `spellcheck` and `draggable`, which Qwik types as booleans, are `{true}` or `{false}`: Qwik
 *   serialises a boolean on them back to `"true"` or `"false"`.
 */
export function qwikStaticValue(
  tag: string,
  namespace: Namespace,
  name: string,
  value: string | true,
): string | true | { code: string } {
  const html = namespace === "html" ? name.toLowerCase() : name;
  if (namespace === "html" && QWIK_BOOLEAN_ATTRIBUTES.has(html)) {
    const untilFound = html === "hidden" && value !== true && value.toLowerCase() === "until-found";
    return untilFound ? value : true;
  }
  if (value === true) return "";
  const numberTyped = isNumberTypedAttribute(namespace === "html" ? tag : "", html);
  if (numberTyped && String(Number(value)) === value) return { code: value };
  if (namespace === "html" && QWIK_BOOLEAN_TYPED.has(html) && /^(?:true|false)$/.test(value)) {
    return { code: value };
  }
  return value;
}

/** Enumerated attributes Qwik types as `boolean` (from the DOM's `spellcheck` and `draggable`). */
const QWIK_BOOLEAN_TYPED: ReadonlySet<string> = new Set(["draggable", "spellcheck"]);
