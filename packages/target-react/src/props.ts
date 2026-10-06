import type { ElementNode } from "@unframework/ir";

/**
 * HTML and SVG attribute names that React spells differently, keyed by their spelling in HTML
 * and SVG. React warns ("Invalid DOM property") about the attribute spelling of any of these.
 * From react-dom's `possibleStandardNames` (19.3); a test checks every entry against it.
 * Attributes SVG already spells in camel case (`viewBox`) are the same in React.
 */
export const REACT_PROP_NAMES: Readonly<Record<string, string>> = {
  // HTML
  "accept-charset": "acceptCharset",
  accesskey: "accessKey",
  allowfullscreen: "allowFullScreen",
  autocapitalize: "autoCapitalize",
  autocomplete: "autoComplete",
  autocorrect: "autoCorrect",
  autofocus: "autoFocus",
  autoplay: "autoPlay",
  autosave: "autoSave",
  cellpadding: "cellPadding",
  cellspacing: "cellSpacing",
  charset: "charSet",
  class: "className",
  classid: "classID",
  colspan: "colSpan",
  contenteditable: "contentEditable",
  contextmenu: "contextMenu",
  controlslist: "controlsList",
  crossorigin: "crossOrigin",
  datetime: "dateTime",
  disablepictureinpicture: "disablePictureInPicture",
  disableremoteplayback: "disableRemotePlayback",
  enctype: "encType",
  enterkeyhint: "enterKeyHint",
  fetchpriority: "fetchPriority",
  for: "htmlFor",
  formaction: "formAction",
  formenctype: "formEncType",
  formmethod: "formMethod",
  formnovalidate: "formNoValidate",
  formtarget: "formTarget",
  frameborder: "frameBorder",
  hreflang: "hrefLang",
  "http-equiv": "httpEquiv",
  imagesizes: "imageSizes",
  imagesrcset: "imageSrcSet",
  inputmode: "inputMode",
  itemid: "itemID",
  itemprop: "itemProp",
  itemref: "itemRef",
  itemscope: "itemScope",
  itemtype: "itemType",
  keyparams: "keyParams",
  keytype: "keyType",
  marginheight: "marginHeight",
  marginwidth: "marginWidth",
  maxlength: "maxLength",
  mediagroup: "mediaGroup",
  minlength: "minLength",
  nomodule: "noModule",
  novalidate: "noValidate",
  playsinline: "playsInline",
  popovertarget: "popoverTarget",
  popovertargetaction: "popoverTargetAction",
  radiogroup: "radioGroup",
  readonly: "readOnly",
  referrerpolicy: "referrerPolicy",
  rowspan: "rowSpan",
  spellcheck: "spellCheck",
  srcdoc: "srcDoc",
  srclang: "srcLang",
  srcset: "srcSet",
  tabindex: "tabIndex",
  usemap: "useMap",
  // SVG presentation and font attributes
  "accent-height": "accentHeight",
  "alignment-baseline": "alignmentBaseline",
  "arabic-form": "arabicForm",
  "baseline-shift": "baselineShift",
  "cap-height": "capHeight",
  "clip-path": "clipPath",
  "clip-rule": "clipRule",
  "color-interpolation": "colorInterpolation",
  "color-interpolation-filters": "colorInterpolationFilters",
  "color-profile": "colorProfile",
  "color-rendering": "colorRendering",
  "dominant-baseline": "dominantBaseline",
  "enable-background": "enableBackground",
  "fill-opacity": "fillOpacity",
  "fill-rule": "fillRule",
  "flood-color": "floodColor",
  "flood-opacity": "floodOpacity",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-size-adjust": "fontSizeAdjust",
  "font-stretch": "fontStretch",
  "font-style": "fontStyle",
  "font-variant": "fontVariant",
  "font-weight": "fontWeight",
  "glyph-name": "glyphName",
  "glyph-orientation-horizontal": "glyphOrientationHorizontal",
  "glyph-orientation-vertical": "glyphOrientationVertical",
  "horiz-adv-x": "horizAdvX",
  "horiz-origin-x": "horizOriginX",
  "image-rendering": "imageRendering",
  "letter-spacing": "letterSpacing",
  "lighting-color": "lightingColor",
  "marker-end": "markerEnd",
  "marker-mid": "markerMid",
  "marker-start": "markerStart",
  "overline-position": "overlinePosition",
  "overline-thickness": "overlineThickness",
  "paint-order": "paintOrder",
  "panose-1": "panose1",
  "pointer-events": "pointerEvents",
  "rendering-intent": "renderingIntent",
  "shape-rendering": "shapeRendering",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "strikethrough-position": "strikethroughPosition",
  "strikethrough-thickness": "strikethroughThickness",
  "stroke-dasharray": "strokeDasharray",
  "stroke-dashoffset": "strokeDashoffset",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-miterlimit": "strokeMiterlimit",
  "stroke-opacity": "strokeOpacity",
  "stroke-width": "strokeWidth",
  "text-anchor": "textAnchor",
  "text-decoration": "textDecoration",
  "text-rendering": "textRendering",
  "transform-origin": "transformOrigin",
  "underline-position": "underlinePosition",
  "underline-thickness": "underlineThickness",
  "unicode-bidi": "unicodeBidi",
  "unicode-range": "unicodeRange",
  "units-per-em": "unitsPerEm",
  "v-alphabetic": "vAlphabetic",
  "v-hanging": "vHanging",
  "v-ideographic": "vIdeographic",
  "v-mathematical": "vMathematical",
  "vector-effect": "vectorEffect",
  "vert-adv-y": "vertAdvY",
  "vert-origin-x": "vertOriginX",
  "vert-origin-y": "vertOriginY",
  "word-spacing": "wordSpacing",
  "writing-mode": "writingMode",
  "x-height": "xHeight",
  // XLink and XML namespaced attributes
  "xlink:actuate": "xlinkActuate",
  "xlink:arcrole": "xlinkArcrole",
  "xlink:href": "xlinkHref",
  "xlink:role": "xlinkRole",
  "xlink:show": "xlinkShow",
  "xlink:title": "xlinkTitle",
  "xlink:type": "xlinkType",
  "xml:base": "xmlBase",
  "xml:lang": "xmlLang",
  "xml:space": "xmlSpace",
  "xmlns:xlink": "xmlnsXlink",
};

/**
 * HTML attributes whose presence alone turns them on, keyed by their HTML spelling. React 19
 * takes them as boolean props: a truthy value renders `name=""`, and a falsy one, the empty
 * string included, removes the attribute. Every boolean attribute the IR can hold is one of
 * these (test/attributes.test.ts checks it), so the target writes them bare and binds them as
 * they are; the analyser rejects the ones React's types lack (`ismap`). From react-dom's
 * `setProp` (19.3), plus the ones React sets as DOM properties (`multiple`, `muted`) or
 * handles itself (`autofocus`, and `checked`, which becomes `defaultChecked`).
 */
export const BOOLEAN_PROPS: ReadonlySet<string> = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "credentialless",
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
  "scoped",
  "seamless",
]);

/**
 * Input types whose `value` React leaves alone (react-dom's `hasReadOnlyValue`, 19.3; a test
 * reads it): the value is a label or a submitted value, never edited state, so React neither
 * controls it nor warns about it. React's client also ignores a `defaultValue` on `submit` and
 * `reset` inputs (`initInput` returns early), so their label would be lost.
 */
export const READ_ONLY_VALUE_TYPES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "hidden",
  "image",
  "radio",
  "reset",
  "submit",
]);

/**
 * The React prop for a form control's initial state. React treats `value` and `checked` as
 * controlled: without an `onChange` it warns and makes the field read-only. A static value is
 * the initial state, which React names `defaultValue` and `defaultChecked`. The `value` of an
 * input whose type React leaves alone stays `value`; React matches the type exactly, and so
 * does this.
 *
 * The type is the element's static `type`: beside a bound `type`, an input's `value` is form
 * state, which the analyser rejects until `v-model` (M3), as it does every `value` and `checked`
 * that is not a fixed value. So of these, only a `<textarea>`'s content (as `value`) and a
 * fixed `value` reach the React target today.
 */
export function formControlProp(
  name: string,
  element: Pick<ElementNode, "tag" | "attributes">,
): string | undefined {
  const { tag } = element;
  if (name === "value" && tag === "input" && READ_ONLY_VALUE_TYPES.has(staticType(element))) {
    return undefined;
  }
  if (name === "value" && (tag === "input" || tag === "select" || tag === "textarea")) {
    return "defaultValue";
  }
  if (name === "checked" && tag === "input") return "defaultChecked";
  return undefined;
}

/** The element's static `type`, or `""` when it has none. */
function staticType(element: Pick<ElementNode, "attributes">): string {
  const type = element.attributes.find(
    (attribute) => attribute.kind === "Static" && attribute.name === "type",
  );
  return type?.kind === "Static" && typeof type.value === "string" ? type.value : "";
}
