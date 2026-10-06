// The SVG vocabulary (ADR-0040): the SVG elements and attributes a component can render inside an
// `<svg>`, with SVG's own case. One copy, so the analyser, the invariants and the targets agree.
//
// Names are case-exact: the HTML parser lower-cases every tag and attribute name it reads, then
// restores SVG's camel case only for the names in its adjustment tables (parse5's
// `SVG_TAG_NAMES_ADJUSTMENT_MAP` and `adjustTokenSVGAttrs`), where a client renderer keeps the
// name as written. So a camel-case name the parser does not restore renders differently on the
// server and in the browser, and is not listed. The analyser's conformance tests check these
// tables against parse5, Vue's `isSVGTag` and the vendored JSX types.

import { ARIA_ATTRIBUTES, isDataAttribute } from "./html.ts";
import { table, words } from "./tables.ts";

/** The namespace of an element: HTML, or SVG inside an `<svg>`. */
export type Namespace = "html" | "svg";

/**
 * The namespace an element with this tag gets inside a parent element of the given namespace:
 * `<svg>` starts SVG, and everything inside it is SVG. (The parser reads the element children
 * of SVG's `<title>`, `<desc>` and `<foreignObject>` as HTML, and React does not: no IR holds
 * one, see `SVG_HTML_INTEGRATION_POINTS`.) A component's root is in HTML.
 */
export function elementNamespace(tag: string, parent: Namespace): Namespace {
  return parent === "svg" || tag === "svg" ? "svg" : "html";
}

/**
 * The SVG elements a component can render, case-exact: the elements the vendored JSX types
 * (`@vue/runtime-dom`'s, `packages/unframework/src/vendor/vue-jsx.d.ts`) list for SVG, with
 * `title`, which they type with HTML's, that Vue's `isSVGTag` also knows. Left out:
 * - names with a hyphen, deprecated in SVG 2 (`color-profile`, `font-face`, …), which the
 *   analyser reads as custom elements;
 * - `feDropShadow`, which the HTML parser (parse5 8) does not restore from `fedropshadow`, so
 *   the server's markup and a client's DOM differ in case;
 * - `a`, which Vue's `isSVGTag` does not know and Solid creates as an HTML link when it is the
 *   root of a template: SVG links land with a later milestone;
 * - `script`, `style`, `foreignObject` and the animation elements, which no component can render
 *   (`SVG_UNRENDERABLE_ELEMENTS`).
 */
export const SVG_ELEMENTS: ReadonlySet<string> = words(`
  circle clipPath defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite
  feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB
  feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight
  feSpecularLighting feSpotLight feTile feTurbulence filter g image line linearGradient marker
  mask metadata mpath path pattern polygon polyline radialGradient rect stop svg switch symbol
  text textPath title tspan use view
`);

/**
 * SVG elements a component cannot render, and why. The analyser reports them (UF3002, or
 * UF1002 for what a later milestone lowers), and no IR holds one.
 */
export const SVG_UNRENDERABLE_ELEMENTS: ReadonlyMap<string, string> = table({
  script:
    "<script> holds code the compiler cannot analyse, and Vue and Angular drop it from templates.",
  style:
    "<style> is not supported: Vue and Angular drop it from templates. A component's styles are a stylesheet it imports.",
  foreignObject:
    "<foreignObject> switches back to HTML inside SVG, which the targets do not agree on yet; it lands with a later milestone.",
  animate:
    "SMIL animation (<animate>) can set any attribute, a `javascript:` `href` included, and makes the rendering depend on time.",
  animateMotion: "SMIL animation (<animateMotion>) makes the rendering depend on time.",
  animateTransform: "SMIL animation (<animateTransform>) makes the rendering depend on time.",
  set: "SMIL animation (<set>) can set any attribute, a `javascript:` `href` included, and makes the rendering depend on time.",
  discard: "SMIL animation (<discard>) removes elements over time, and only Chromium knows it.",
});

/**
 * The SVG elements whose text renders as their content: an interpolation sits only in them.
 * Text elsewhere in SVG is not rendered, and Svelte drops whitespace there.
 */
export const SVG_TEXT_ELEMENTS: ReadonlySet<string> = words("desc text textPath title tspan");

/**
 * The SVG element whose whitespace-only text Svelte keeps, with everything inside it: Svelte 5
 * drops whitespace-only text anywhere else in SVG (`can_remove_entirely`, which keeps it only
 * under a `<text>`), and the other targets keep it.
 */
export const SVG_WHITESPACE_KEEPING_ELEMENT = "text";

/**
 * SVG elements whose element children the HTML parser and Vue's compiler put back in the HTML
 * namespace, where React keeps them in SVG: they hold text only.
 */
export const SVG_HTML_INTEGRATION_POINTS: ReadonlySet<string> = words("desc foreignObject title");

/**
 * SVG 2's presentation attributes, which any SVG element accepts, as the vendored JSX types
 * spell them: without the ones SVG 2 deprecates (`clip`, `color-rendering`,
 * `enable-background`, `glyph-orientation-*`, `kerning`) or the types lack (`mask-type`,
 * `transform-origin`, `white-space`).
 */
export const SVG_PRESENTATION_ATTRIBUTES: ReadonlySet<string> = words(`
  alignment-baseline baseline-shift clip-path clip-rule color color-interpolation
  color-interpolation-filters cursor direction display dominant-baseline fill fill-opacity
  fill-rule filter flood-color flood-opacity font-family font-size font-size-adjust font-stretch
  font-style font-variant font-weight image-rendering letter-spacing lighting-color marker-end
  marker-mid marker-start mask opacity overflow paint-order pointer-events shape-rendering
  stop-color stop-opacity stroke stroke-dasharray stroke-dashoffset stroke-linecap
  stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration
  text-rendering transform unicode-bidi vector-effect visibility word-spacing writing-mode
`);

/**
 * The attributes every SVG element accepts: SVG's core attributes the vendored types know
 * (`id`, `lang`, `tabindex`), `class` and `style`, ARIA's `role`, and the presentation
 * attributes. ARIA's states and properties and `data-*` attributes are accepted as on HTML.
 * The `xml:` and `xlink:` attributes and `xmlns` are not: their namespaces render differently
 * per target, and `href` replaces `xlink:href`.
 */
export const SVG_GLOBAL_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...words("class id lang role style tabindex"),
  ...SVG_PRESENTATION_ATTRIBUTES,
]);

/** The attributes of every filter primitive (`fe*` but the light sources and transfer functions). */
const FILTER_PRIMITIVE = "height result width x y";

/**
 * Each SVG element's own attributes (SVG 2 and Filter Effects 1), besides the global ones,
 * that the vendored JSX types know, with SVG's case. Left out: the conditional processing
 * attributes (`systemLanguage` makes the rendering depend on the reader's language), and the
 * attributes SVG 2 removes (`version`, `baseProfile`, `zoomAndPan`, `requiredFeatures`).
 */
export const SVG_ELEMENT_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = table({
  circle: words("cx cy pathLength r"),
  clipPath: words("clipPathUnits"),
  ellipse: words("cx cy pathLength rx ry"),
  feBlend: words(`${FILTER_PRIMITIVE} in in2 mode`),
  feColorMatrix: words(`${FILTER_PRIMITIVE} in type values`),
  feComponentTransfer: words(`${FILTER_PRIMITIVE} in`),
  feComposite: words(`${FILTER_PRIMITIVE} in in2 k1 k2 k3 k4 operator`),
  feConvolveMatrix: words(`
    ${FILTER_PRIMITIVE} bias divisor edgeMode in kernelMatrix kernelUnitLength order
    preserveAlpha targetX targetY
  `),
  feDiffuseLighting: words(`${FILTER_PRIMITIVE} diffuseConstant in kernelUnitLength surfaceScale`),
  feDisplacementMap: words(`${FILTER_PRIMITIVE} in in2 scale xChannelSelector yChannelSelector`),
  feDistantLight: words("azimuth elevation"),
  feFlood: words(FILTER_PRIMITIVE),
  feFuncA: words("amplitude exponent intercept offset slope tableValues type"),
  feFuncB: words("amplitude exponent intercept offset slope tableValues type"),
  feFuncG: words("amplitude exponent intercept offset slope tableValues type"),
  feFuncR: words("amplitude exponent intercept offset slope tableValues type"),
  feGaussianBlur: words(`${FILTER_PRIMITIVE} edgeMode in stdDeviation`),
  feImage: words(`${FILTER_PRIMITIVE} href preserveAspectRatio`),
  feMerge: words(FILTER_PRIMITIVE),
  feMergeNode: words("in"),
  feMorphology: words(`${FILTER_PRIMITIVE} in operator radius`),
  feOffset: words(`${FILTER_PRIMITIVE} dx dy in`),
  fePointLight: words("x y z"),
  feSpecularLighting: words(`
    ${FILTER_PRIMITIVE} in kernelUnitLength specularConstant specularExponent surfaceScale
  `),
  feSpotLight: words(`
    limitingConeAngle pointsAtX pointsAtY pointsAtZ specularExponent x y z
  `),
  feTile: words(`${FILTER_PRIMITIVE} in`),
  feTurbulence: words(`${FILTER_PRIMITIVE} baseFrequency numOctaves seed stitchTiles type`),
  filter: words("filterUnits height primitiveUnits width x y"),
  image: words("height href preserveAspectRatio width x y"),
  line: words("pathLength x1 x2 y1 y2"),
  linearGradient: words("gradientTransform gradientUnits href spreadMethod x1 x2 y1 y2"),
  marker: words(
    "markerHeight markerUnits markerWidth orient preserveAspectRatio refX refY viewBox",
  ),
  mask: words("height maskContentUnits maskUnits width x y"),
  mpath: words("href"),
  path: words("d pathLength"),
  pattern: words(`
    height href patternContentUnits patternTransform patternUnits preserveAspectRatio viewBox
    width x y
  `),
  polygon: words("pathLength points"),
  polyline: words("pathLength points"),
  radialGradient: words("cx cy fx fy gradientTransform gradientUnits href r spreadMethod"),
  rect: words("height pathLength rx ry width x y"),
  stop: words("offset"),
  svg: words("height preserveAspectRatio viewBox width x y"),
  symbol: words("height preserveAspectRatio refX refY viewBox width x y"),
  text: words("dx dy lengthAdjust rotate textLength x y"),
  textPath: words("href lengthAdjust method spacing startOffset textLength"),
  tspan: words("dx dy lengthAdjust rotate textLength x y"),
  use: words("height href width x y"),
  view: words("preserveAspectRatio viewBox"),
});

/** Whether a tag is an SVG element a component can render (case-exact). */
export function isSvgElement(tag: string): boolean {
  return SVG_ELEMENTS.has(tag);
}

/**
 * SVG's descriptive elements, which are not rendered: they take the core attributes only
 * (`SVG_DESCRIPTIVE_ATTRIBUTES`). A presentation attribute styles nothing there, and Vue types
 * `<title>` with HTML's attributes, so one fails vue-tsc (L4).
 */
export const SVG_DESCRIPTIVE_ELEMENTS: ReadonlySet<string> = words("desc title");

/** The attributes of a descriptive element, besides ARIA's and `data-*`. */
export const SVG_DESCRIPTIVE_ATTRIBUTES: ReadonlySet<string> = words("class id lang style");

/** Whether an attribute (case-exact) is an attribute of the SVG element. */
export function isSvgAttribute(tag: string, name: string): boolean {
  const own = SVG_DESCRIPTIVE_ELEMENTS.has(tag)
    ? SVG_DESCRIPTIVE_ATTRIBUTES.has(name)
    : SVG_GLOBAL_ATTRIBUTES.has(name) || (SVG_ELEMENT_ATTRIBUTES.get(tag)?.has(name) ?? false);
  return own || ARIA_ATTRIBUTES.has(name) || isDataAttribute(name);
}
