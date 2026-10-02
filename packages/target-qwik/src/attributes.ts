import type { Attribute, ElementNode } from "@unframework/ir";

/**
 * HTML attribute names that Qwik 2's JSX types only accept in camel case (`tabIndex`,
 * `colSpan`). The DOM is the same either way: HTML attribute names are case-insensitive, so
 * Qwik's `setAttribute` and the HTML parser reading its server output both store `tabindex`.
 * The lower-case spelling fails type-checking (L4). Read from the `QwikIntrinsicElements` of
 * @qwik.dev/core 2.0.0-beta.47; test/attributes.test.ts type-checks every attribute the
 * authoring types accept, so a missing entry or a Qwik upgrade that changes one fails loudly.
 *
 * Left for M1 (attribute names and values per target), and pinned by that test: some
 * attributes have no Qwik spelling at all (`<input form>`, `<input list>`, global
 * `contextmenu`), and Qwik types some values narrower than HTML, so a static string fails L4
 * although it renders the same: numbers (`tabIndex="0"` wants `{0}`; also `colSpan`,
 * `maxLength`, `rows`…) and the enumerated `spellcheck`/`draggable` (`{false}`, which Qwik
 * serialises back to `"false"`).
 */
export const QWIK_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  accesskey: "accessKey",
  allowfullscreen: "allowFullscreen",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  closedby: "closedBy",
  colspan: "colSpan",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  datetime: "dateTime",
  dirname: "dirName",
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
  ismap: "isMap",
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
  writingsuggestions: "writingSuggestions",
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
  "ismap",
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

type Namespace = "html" | "svg" | "math";

/**
 * Rewrites an element tree's attributes into Qwik's JSX spelling. Only HTML elements change:
 * SVG and MathML attribute names are case-sensitive, so `<svg>` and `<math>` subtrees keep
 * theirs (until a `<foreignObject>` returns to HTML).
 */
export function toQwikAttributes(node: ElementNode, parent: Namespace = "html"): ElementNode {
  const namespace =
    parent === "html" && (node.tag === "svg" || node.tag === "math") ? node.tag : parent;
  const childNamespace = namespace === "svg" && node.tag === "foreignObject" ? "html" : namespace;
  return {
    ...node,
    attributes: namespace === "html" ? node.attributes.map(htmlAttribute) : node.attributes,
    children: node.children.map((child) =>
      child.kind === "Element" ? toQwikAttributes(child, childNamespace) : child,
    ),
  };
}

/** HTML attribute names are case-insensitive, so `readOnly` in the source is `readonly`. */
function htmlAttribute(attribute: Attribute): Attribute {
  const html = attribute.name.toLowerCase();
  const name = QWIK_ATTRIBUTE_NAMES[html] ?? attribute.name;
  const value = qwikValue(html, attribute.value);
  return name === attribute.name && value === attribute.value
    ? attribute
    : { ...attribute, name, value };
}

/**
 * A boolean attribute is written bare whatever its value, except `hidden="until-found"`, a
 * state of its own that Qwik's types accept; any other attribute without a value is empty.
 */
function qwikValue(html: string, value: string | true): string | true {
  if (!QWIK_BOOLEAN_ATTRIBUTES.has(html)) return value === true ? "" : value;
  const untilFound = html === "hidden" && value !== true && value.toLowerCase() === "until-found";
  return untilFound ? value : true;
}
