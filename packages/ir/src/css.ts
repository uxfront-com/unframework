// CSS facts the `style` attribute kind relies on (ADR-0038): the properties every target writes a
// bare number to alike, which declarations overlap, and what a static value may hold. One copy,
// so the analyser, the invariants and the tests' normaliser agree.

import { table, words } from "./tables.ts";

/**
 * The properties a number renders on without a unit, as CSS names: the standard properties both
 * react-dom's `isUnitlessNumber` (19.3) and Qwik's `unitlessNumbers` (2.0 beta) list, which add
 * no `px` to a number, where every other target writes the number as it is. A number on any
 * other property gets `px` from React or Qwik only. Left out of their intersection: `box-flex`,
 * `box-flex-group` and `box-ordinal-group` (old flexbox, never standard), `line-clamp`
 * (Chromium knows only `-webkit-line-clamp`, which Vue's client sets instead) and the
 * vendor-prefixed names. React's SVG properties (`stroke-width`, …) are not in Qwik's list.
 */
export const UNITLESS_PROPERTIES: ReadonlySet<string> = words(`
  animation-iteration-count aspect-ratio border-image-outset border-image-slice
  border-image-width column-count columns flex flex-grow flex-shrink font-weight grid-area
  grid-column grid-column-end grid-column-start grid-row grid-row-end grid-row-start
  line-height opacity order orphans scale tab-size widows z-index zoom
`);

/**
 * Each shorthand property (and each legacy alias) with the longhands it sets, as Chromium 153
 * (the browser the tests run, Playwright 1.63) expands it: setting it through the CSSOM sets
 * exactly these. Two declarations overlap when their longhands do, and then the targets that
 * write a `style` as an object (React, Solid, Qwik) cannot keep their order, which decides the
 * value. Vendor-prefixed shorthands are not listed: the analyser does not accept them.
 */
export const CSS_SHORTHANDS: ReadonlyMap<string, ReadonlySet<string>> = table({
  animation: words(`
    animation-duration animation-timing-function animation-delay animation-iteration-count
    animation-direction animation-fill-mode animation-play-state animation-name animation-timeline
    animation-range-start animation-range-end
  `),
  "animation-range": words("animation-range-start animation-range-end"),
  background: words(`
    background-image background-position-x background-position-y background-size background-repeat
    background-attachment background-origin background-clip background-color
  `),
  "background-position": words("background-position-x background-position-y"),
  border: words(`
    border-top-color border-top-style border-top-width border-right-color border-right-style
    border-right-width border-bottom-color border-bottom-style border-bottom-width
    border-left-color border-left-style border-left-width border-image-source border-image-slice
    border-image-width border-image-outset border-image-repeat
  `),
  "border-block": words(`
    border-block-start-color border-block-start-style border-block-start-width
    border-block-end-color border-block-end-style border-block-end-width
  `),
  "border-block-color": words("border-block-start-color border-block-end-color"),
  "border-block-end": words("border-block-end-width border-block-end-style border-block-end-color"),
  "border-block-start": words(`
    border-block-start-width border-block-start-style border-block-start-color
  `),
  "border-block-style": words("border-block-start-style border-block-end-style"),
  "border-block-width": words("border-block-start-width border-block-end-width"),
  "border-bottom": words("border-bottom-width border-bottom-style border-bottom-color"),
  "border-color": words(`
    border-top-color border-right-color border-bottom-color border-left-color
  `),
  "border-image": words(`
    border-image-source border-image-slice border-image-width border-image-outset
    border-image-repeat
  `),
  "border-inline": words(`
    border-inline-start-color border-inline-start-style border-inline-start-width
    border-inline-end-color border-inline-end-style border-inline-end-width
  `),
  "border-inline-color": words("border-inline-start-color border-inline-end-color"),
  "border-inline-end": words(`
    border-inline-end-width border-inline-end-style border-inline-end-color
  `),
  "border-inline-start": words(`
    border-inline-start-width border-inline-start-style border-inline-start-color
  `),
  "border-inline-style": words("border-inline-start-style border-inline-end-style"),
  "border-inline-width": words("border-inline-start-width border-inline-end-width"),
  "border-left": words("border-left-width border-left-style border-left-color"),
  "border-radius": words(`
    border-top-left-radius border-top-right-radius border-bottom-right-radius
    border-bottom-left-radius
  `),
  "border-right": words("border-right-width border-right-style border-right-color"),
  "border-spacing": words("-webkit-border-horizontal-spacing -webkit-border-vertical-spacing"),
  "border-style": words(`
    border-top-style border-right-style border-bottom-style border-left-style
  `),
  "border-top": words("border-top-width border-top-style border-top-color"),
  "border-width": words(`
    border-top-width border-right-width border-bottom-width border-left-width
  `),
  "column-rule": words("column-rule-width column-rule-style column-rule-color"),
  "column-rule-inset": words(`
    column-rule-inset-cap-start column-rule-inset-cap-end column-rule-inset-junction-start
    column-rule-inset-junction-end
  `),
  "column-rule-inset-cap": words("column-rule-inset-cap-start column-rule-inset-cap-end"),
  "column-rule-inset-end": words("column-rule-inset-cap-end column-rule-inset-junction-end"),
  "column-rule-inset-junction": words(`
    column-rule-inset-junction-start column-rule-inset-junction-end
  `),
  "column-rule-inset-start": words("column-rule-inset-cap-start column-rule-inset-junction-start"),
  columns: words("column-width column-count column-height column-wrap"),
  "contain-intrinsic-size": words("contain-intrinsic-width contain-intrinsic-height"),
  container: words("container-name container-type"),
  "corner-block-end-shape": words("corner-end-start-shape corner-end-end-shape"),
  "corner-block-start-shape": words("corner-start-start-shape corner-start-end-shape"),
  "corner-bottom-shape": words("corner-bottom-left-shape corner-bottom-right-shape"),
  "corner-inline-end-shape": words("corner-start-end-shape corner-end-end-shape"),
  "corner-inline-start-shape": words("corner-start-start-shape corner-end-start-shape"),
  "corner-left-shape": words("corner-top-left-shape corner-bottom-left-shape"),
  "corner-right-shape": words("corner-top-right-shape corner-bottom-right-shape"),
  "corner-shape": words(`
    corner-top-left-shape corner-top-right-shape corner-bottom-right-shape
    corner-bottom-left-shape
  `),
  "corner-top-shape": words("corner-top-left-shape corner-top-right-shape"),
  flex: words("flex-grow flex-shrink flex-basis"),
  "flex-flow": words("flex-direction flex-wrap"),
  font: words(`
    font-style font-variant-ligatures font-variant-caps font-variant-numeric
    font-variant-east-asian font-variant-alternates font-variant-position font-variant-emoji
    font-weight font-stretch font-size line-height font-family font-optical-sizing
    font-size-adjust font-kerning font-feature-settings font-variation-settings
    font-language-override
  `),
  "font-synthesis": words("font-synthesis-weight font-synthesis-style font-synthesis-small-caps"),
  "font-variant": words(`
    font-variant-ligatures font-variant-caps font-variant-alternates font-variant-numeric
    font-variant-east-asian font-variant-position font-variant-emoji
  `),
  gap: words("row-gap column-gap"),
  grid: words(`
    grid-template-rows grid-template-columns grid-template-areas grid-auto-flow grid-auto-rows
    grid-auto-columns
  `),
  "grid-area": words("grid-row-start grid-column-start grid-row-end grid-column-end"),
  "grid-column": words("grid-column-start grid-column-end"),
  "grid-column-gap": words("column-gap"),
  "grid-gap": words("row-gap column-gap"),
  "grid-row": words("grid-row-start grid-row-end"),
  "grid-row-gap": words("row-gap"),
  "grid-template": words("grid-template-rows grid-template-columns grid-template-areas"),
  inset: words("top right bottom left"),
  "inset-block": words("inset-block-start inset-block-end"),
  "inset-inline": words("inset-inline-start inset-inline-end"),
  "interest-delay": words("interest-delay-start interest-delay-end"),
  "list-style": words("list-style-position list-style-image list-style-type"),
  margin: words("margin-top margin-right margin-bottom margin-left"),
  "margin-block": words("margin-block-start margin-block-end"),
  "margin-inline": words("margin-inline-start margin-inline-end"),
  marker: words("marker-start marker-mid marker-end"),
  mask: words(`
    mask-image -webkit-mask-position-x -webkit-mask-position-y mask-size mask-repeat mask-origin
    mask-clip mask-composite mask-mode
  `),
  "mask-position": words("-webkit-mask-position-x -webkit-mask-position-y"),
  offset: words("offset-position offset-path offset-distance offset-rotate offset-anchor"),
  outline: words("outline-color outline-style outline-width"),
  overflow: words("overflow-x overflow-y"),
  "overscroll-behavior": words("overscroll-behavior-x overscroll-behavior-y"),
  padding: words("padding-top padding-right padding-bottom padding-left"),
  "padding-block": words("padding-block-start padding-block-end"),
  "padding-inline": words("padding-inline-start padding-inline-end"),
  "page-break-after": words("break-after"),
  "page-break-before": words("break-before"),
  "page-break-inside": words("break-inside"),
  "place-content": words("align-content justify-content"),
  "place-items": words("align-items justify-items"),
  "place-self": words("align-self justify-self"),
  "position-try": words("position-try-order position-try-fallbacks"),
  "row-rule": words("row-rule-width row-rule-style row-rule-color"),
  "row-rule-inset": words(`
    row-rule-inset-cap-start row-rule-inset-cap-end row-rule-inset-junction-start
    row-rule-inset-junction-end
  `),
  "row-rule-inset-cap": words("row-rule-inset-cap-start row-rule-inset-cap-end"),
  "row-rule-inset-end": words("row-rule-inset-cap-end row-rule-inset-junction-end"),
  "row-rule-inset-junction": words("row-rule-inset-junction-start row-rule-inset-junction-end"),
  "row-rule-inset-start": words("row-rule-inset-cap-start row-rule-inset-junction-start"),
  rule: words(`
    column-rule-width column-rule-style column-rule-color row-rule-width row-rule-style
    row-rule-color
  `),
  "rule-break": words("row-rule-break column-rule-break"),
  "rule-color": words("column-rule-color row-rule-color"),
  "rule-inset": words(`
    row-rule-inset-cap-start row-rule-inset-cap-end row-rule-inset-junction-start
    row-rule-inset-junction-end column-rule-inset-cap-start column-rule-inset-cap-end
    column-rule-inset-junction-start column-rule-inset-junction-end
  `),
  "rule-inset-cap": words(`
    row-rule-inset-cap-start row-rule-inset-cap-end column-rule-inset-cap-start
    column-rule-inset-cap-end
  `),
  "rule-inset-end": words(`
    column-rule-inset-cap-end column-rule-inset-junction-end row-rule-inset-cap-end
    row-rule-inset-junction-end
  `),
  "rule-inset-junction": words(`
    row-rule-inset-junction-start row-rule-inset-junction-end column-rule-inset-junction-start
    column-rule-inset-junction-end
  `),
  "rule-inset-start": words(`
    column-rule-inset-cap-start column-rule-inset-junction-start row-rule-inset-cap-start
    row-rule-inset-junction-start
  `),
  "rule-style": words("column-rule-style row-rule-style"),
  "rule-visibility-items": words("column-rule-visibility-items row-rule-visibility-items"),
  "rule-width": words("column-rule-width row-rule-width"),
  "scroll-margin": words(`
    scroll-margin-top scroll-margin-right scroll-margin-bottom scroll-margin-left
  `),
  "scroll-margin-block": words("scroll-margin-block-start scroll-margin-block-end"),
  "scroll-margin-inline": words("scroll-margin-inline-start scroll-margin-inline-end"),
  "scroll-padding": words(`
    scroll-padding-top scroll-padding-right scroll-padding-bottom scroll-padding-left
  `),
  "scroll-padding-block": words("scroll-padding-block-start scroll-padding-block-end"),
  "scroll-padding-inline": words("scroll-padding-inline-start scroll-padding-inline-end"),
  "scroll-timeline": words("scroll-timeline-name scroll-timeline-axis"),
  "text-box": words("text-box-trim text-box-edge"),
  "text-decoration": words(`
    text-decoration-line text-decoration-thickness text-decoration-style text-decoration-color
  `),
  "text-emphasis": words("text-emphasis-style text-emphasis-color"),
  "text-wrap": words("text-wrap-mode text-wrap-style"),
  "timeline-trigger": words(`
    timeline-trigger-name timeline-trigger-source timeline-trigger-activation-range-start
    timeline-trigger-activation-range-end timeline-trigger-active-range-start
    timeline-trigger-active-range-end
  `),
  "timeline-trigger-activation-range": words(`
    timeline-trigger-activation-range-start timeline-trigger-activation-range-end
  `),
  "timeline-trigger-active-range": words(`
    timeline-trigger-active-range-start timeline-trigger-active-range-end
  `),
  transition: words(`
    transition-property transition-duration transition-timing-function transition-delay
    transition-behavior
  `),
  "view-timeline": words("view-timeline-name view-timeline-axis view-timeline-inset"),
  "white-space": words("white-space-collapse text-wrap-mode"),
  "word-wrap": words("overflow-wrap"),
});

/**
 * Whether the order of two declarations of one `style` decides what renders: they set a
 * longhand in common (the same property, a shorthand and one of its longhands, two shorthands
 * that share one, or `all` and anything but `direction`, `unicode-bidi` and custom properties,
 * which `all` does not reset), or a flow-relative longhand and a physical one that the writing
 * mode can make the same (`margin-inline-start` and `margin-left`, `inline-size` and `width`),
 * where the later one wins (CSS Logical Properties, §4). The analyser, the invariants and the
 * tests' normaliser read the same answer.
 */
export function cssPropertiesOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (isCustomProperty(a) || isCustomProperty(b)) return false;
  if (a === "all" || b === "all") {
    const other = a === "all" ? b : a;
    return other !== "direction" && other !== "unicode-bidi";
  }
  const own = longhandsOf(a);
  const others = longhandsOf(b);
  if ([...own].some((longhand) => others.has(longhand))) return true;
  const groups = [...others].map(flowGroup);
  return [...own].some((longhand) => {
    const group = flowGroup(longhand);
    return (
      group !== undefined &&
      groups.some((other) => other?.name === group.name && other.logical !== group.logical)
    );
  });
}

/** The longhands a property sets: itself for a longhand. */
function longhandsOf(property: string): ReadonlySet<string> {
  return CSS_SHORTHANDS.get(property) ?? new Set([property]);
}

/**
 * Where a flow-relative longhand and a physical one can set the same value: its group, and
 * whether it is the flow-relative one. `margin-inline-start` is `margin-left` or `margin-right`
 * as the writing mode and direction say.
 */
function flowGroup(longhand: string): { name: string; logical: boolean } | undefined {
  const side =
    /^(margin|padding|scroll-margin|scroll-padding|inset|border)-(?:(block|inline)-(?:start|end)|top|right|bottom|left)(-width|-style|-color)?$/.exec(
      longhand,
    );
  if (side) return { name: `${side[1]}${side[3] ?? ""}`, logical: side[2] !== undefined };
  if (/^(?:top|right|bottom|left)$/.test(longhand)) return { name: "inset", logical: false };
  const corner = /^border-(?:(?:start|end)-(?:start|end)|(top|bottom)-(?:left|right))-radius$/.exec(
    longhand,
  );
  if (corner) return { name: "border-radius", logical: corner[1] === undefined };
  const size = /^((?:min-|max-|contain-intrinsic-)?)(?:(inline|block)-size|width|height)$/.exec(
    longhand,
  );
  if (size) return { name: `${size[1]}size`, logical: size[2] !== undefined };
  const axis = /^(overflow|overscroll-behavior)-(?:(inline|block)|x|y)$/.exec(longhand);
  if (axis) return { name: axis[1]!, logical: axis[2] !== undefined };
  return undefined;
}

/**
 * Every CSS property Chromium 153 knows (the browser the tests run, Playwright 1.63), longhands,
 * shorthands and legacy aliases, without vendor prefixes: the names its CSSOM exposes on a
 * `style` (in camel case, read as CSS names) and lists in a computed style, that
 * `CSS.supports(name, "initial")` accepts. A name outside it is almost always a typo, which no
 * browser applies and Solid's lint (`solid/style-prop`) rejects.
 */
export const CSS_PROPERTIES: ReadonlySet<string> = words(`
  accent-color align-content align-items align-self alignment-baseline all anchor-name anchor-scope
  animation animation-composition animation-delay animation-direction animation-duration
  animation-fill-mode animation-iteration-count animation-name animation-play-state animation-range
  animation-range-end animation-range-start animation-timeline animation-timing-function
  animation-trigger app-region appearance aspect-ratio backdrop-filter backface-visibility
  background background-attachment background-blend-mode background-clip background-color
  background-image background-origin background-position background-position-x
  background-position-y background-repeat background-size baseline-shift baseline-source block-size
  border border-block border-block-color border-block-end border-block-end-color
  border-block-end-style border-block-end-width border-block-start border-block-start-color
  border-block-start-style border-block-start-width border-block-style border-block-width
  border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius
  border-bottom-style border-bottom-width border-collapse border-color border-end-end-radius
  border-end-start-radius border-image border-image-outset border-image-repeat border-image-slice
  border-image-source border-image-width border-inline border-inline-color border-inline-end
  border-inline-end-color border-inline-end-style border-inline-end-width border-inline-start
  border-inline-start-color border-inline-start-style border-inline-start-width border-inline-style
  border-inline-width border-left border-left-color border-left-style border-left-width
  border-radius border-right border-right-color border-right-style border-right-width border-shape
  border-spacing border-start-end-radius border-start-start-radius border-style border-top
  border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width
  border-width bottom box-decoration-break box-shadow box-sizing break-after break-before
  break-inside buffered-rendering caption-side caret-animation caret-color caret-shape clear clip
  clip-path clip-rule color color-interpolation color-interpolation-filters color-rendering
  color-scheme column-count column-fill column-gap column-height column-rule column-rule-break
  column-rule-color column-rule-inset column-rule-inset-cap column-rule-inset-cap-end
  column-rule-inset-cap-start column-rule-inset-end column-rule-inset-junction
  column-rule-inset-junction-end column-rule-inset-junction-start column-rule-inset-start
  column-rule-style column-rule-visibility-items column-rule-width column-span column-width
  column-wrap columns contain contain-intrinsic-block-size contain-intrinsic-height
  contain-intrinsic-inline-size contain-intrinsic-size contain-intrinsic-width container
  container-name container-type content content-visibility corner-block-end-shape
  corner-block-start-shape corner-bottom-left-shape corner-bottom-right-shape corner-bottom-shape
  corner-end-end-shape corner-end-start-shape corner-inline-end-shape corner-inline-start-shape
  corner-left-shape corner-right-shape corner-shape corner-start-end-shape corner-start-start-shape
  corner-top-left-shape corner-top-right-shape corner-top-shape counter-increment counter-reset
  counter-set cursor cx cy d direction display dominant-baseline dynamic-range-limit empty-cells
  field-sizing fill fill-opacity fill-rule filter flex flex-basis flex-direction flex-flow
  flex-grow flex-line-count flex-shrink flex-wrap float flood-color flood-opacity font font-family
  font-feature-settings font-kerning font-language-override font-optical-sizing font-palette
  font-size font-size-adjust font-stretch font-style font-synthesis font-synthesis-small-caps
  font-synthesis-style font-synthesis-weight font-variant font-variant-alternates font-variant-caps
  font-variant-east-asian font-variant-emoji font-variant-ligatures font-variant-numeric
  font-variant-position font-variation-settings font-weight forced-color-adjust gap grid grid-area
  grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-gap
  grid-column-start grid-gap grid-row grid-row-end grid-row-gap grid-row-start grid-template
  grid-template-areas grid-template-columns grid-template-rows height hyphenate-character
  hyphenate-limit-chars hyphens image-orientation image-rendering initial-letter inline-size inset
  inset-block inset-block-end inset-block-start inset-inline inset-inline-end inset-inline-start
  interactivity interest-delay interest-delay-end interest-delay-start interpolate-size isolation
  justify-content justify-items justify-self left letter-spacing lighting-color line-break
  line-height list-style list-style-image list-style-position list-style-type margin margin-block
  margin-block-end margin-block-start margin-bottom margin-inline margin-inline-end
  margin-inline-start margin-left margin-right margin-top marker marker-end marker-mid marker-start
  mask mask-clip mask-composite mask-image mask-mode mask-origin mask-position mask-repeat
  mask-size mask-type math-depth math-shift math-style max-block-size max-height max-inline-size
  max-width min-block-size min-height min-inline-size min-width mix-blend-mode object-fit
  object-position object-view-box offset offset-anchor offset-distance offset-path offset-position
  offset-rotate opacity order orphans outline outline-color outline-offset outline-style
  outline-width overflow overflow-anchor overflow-block overflow-clip-margin overflow-inline
  overflow-wrap overflow-x overflow-y overlay overscroll-behavior overscroll-behavior-block
  overscroll-behavior-inline overscroll-behavior-x overscroll-behavior-y padding padding-block
  padding-block-end padding-block-start padding-bottom padding-inline padding-inline-end
  padding-inline-start padding-left padding-right padding-top page page-break-after
  page-break-before page-break-inside page-margin-safety page-orientation paint-order perspective
  perspective-origin place-content place-items place-self pointer-events position position-anchor
  position-area position-try position-try-fallbacks position-try-order position-visibility
  print-color-adjust quotes r reading-flow reading-order resize right rotate row-gap row-rule
  row-rule-break row-rule-color row-rule-inset row-rule-inset-cap row-rule-inset-cap-end
  row-rule-inset-cap-start row-rule-inset-end row-rule-inset-junction row-rule-inset-junction-end
  row-rule-inset-junction-start row-rule-inset-start row-rule-style row-rule-visibility-items
  row-rule-width ruby-align ruby-overhang ruby-position rule rule-break rule-color rule-inset
  rule-inset-cap rule-inset-end rule-inset-junction rule-inset-start rule-overlap rule-style
  rule-visibility-items rule-width rx ry scale scroll-axis-lock scroll-behavior
  scroll-initial-target scroll-margin scroll-margin-block scroll-margin-block-end
  scroll-margin-block-start scroll-margin-bottom scroll-margin-inline scroll-margin-inline-end
  scroll-margin-inline-start scroll-margin-left scroll-margin-right scroll-margin-top
  scroll-marker-group scroll-padding scroll-padding-block scroll-padding-block-end
  scroll-padding-block-start scroll-padding-bottom scroll-padding-inline scroll-padding-inline-end
  scroll-padding-inline-start scroll-padding-left scroll-padding-right scroll-padding-top
  scroll-snap-align scroll-snap-stop scroll-snap-type scroll-target-group scroll-timeline
  scroll-timeline-axis scroll-timeline-name scrollbar-color scrollbar-gutter scrollbar-width
  shape-image-threshold shape-margin shape-outside shape-rendering size speak stop-color
  stop-opacity stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin
  stroke-miterlimit stroke-opacity stroke-width tab-size table-layout text-align text-align-last
  text-anchor text-autospace text-box text-box-edge text-box-trim text-combine-upright
  text-decoration text-decoration-color text-decoration-line text-decoration-skip-ink
  text-decoration-style text-decoration-thickness text-emphasis text-emphasis-color
  text-emphasis-position text-emphasis-style text-fit text-indent text-justify text-orientation
  text-overflow text-rendering text-shadow text-size-adjust text-spacing-trim text-transform
  text-underline-offset text-underline-position text-wrap text-wrap-mode text-wrap-style
  timeline-scope timeline-trigger timeline-trigger-activation-range
  timeline-trigger-activation-range-end timeline-trigger-activation-range-start
  timeline-trigger-active-range timeline-trigger-active-range-end
  timeline-trigger-active-range-start timeline-trigger-name timeline-trigger-source top
  touch-action transform transform-box transform-origin transform-style transition
  transition-behavior transition-delay transition-duration transition-property
  transition-timing-function translate trigger-scope unicode-bidi user-select vector-effect
  vertical-align view-timeline view-timeline-axis view-timeline-inset view-timeline-name
  view-transition-class view-transition-group view-transition-name view-transition-scope visibility
  white-space white-space-collapse widows width will-change window-drag word-break word-spacing
  word-wrap writing-mode x y z-index zoom
`);

/** Whether a declaration's property is a CSS property Chromium knows, or a custom property. */
export function isKnownCssProperty(name: string): boolean {
  return CSS_PROPERTIES.has(name) || isCustomProperty(name);
}

/** Whether a name is a custom property, `--gap`: two hyphens and ASCII name characters. */
export function isCustomProperty(name: string): boolean {
  return /^--[A-Za-z0-9_-]+$/.test(name);
}

/**
 * Whether Angular renames a declaration's property: its compiler and its server DOM lowercase
 * every property they parse, and a custom property is case-sensitive (`--Gap` becomes `--gap`,
 * which `var(--Gap)` does not find). The analyser reports it (UF3022), and no IR holds one.
 */
export function angularLowercases(property: string): boolean {
  return /[A-Z]/.test(property);
}

/**
 * Whether Angular reads a static value differently from CSS. Its compiler parses a static
 * `style` again, and its server DOM every style it sets (`parse` in its style parser): it knows
 * neither escapes nor comments, ends a string at a quote of its kind even when escaped, and
 * counts the parentheses inside strings. Read that way from the start of its declaration, a
 * value must hold no `;` that ends it, and end outside its strings and parentheses, or the
 * declarations after it run into it (`content: "a\";b"`, `content: "("`). The analyser reports
 * it (UF3022), and no IR holds one.
 */
export function angularMisreads(value: string): boolean {
  let depth = 0;
  let quote: string | undefined;
  for (const character of value) {
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === '"' || character === "'") {
      if (quote === undefined) quote = character;
      else if (quote === character) quote = undefined;
    } else if (character === ";" && depth === 0 && quote === undefined) return true;
  }
  return depth !== 0 || quote !== undefined;
}

/**
 * Whether a name is a property a `style` declaration may set: a standard property in lower case
 * and without a vendor prefix (`margin-top`), or a custom property. Every target writes it as
 * it is, or in camel case where its object form needs it.
 */
export function isCssPropertyName(name: string): boolean {
  return /^[a-z]+(?:-[a-z]+)*$/.test(name) || isCustomProperty(name);
}

/**
 * Why a static declaration's value is not one CSS value the targets can write alike, or
 * `undefined`: it is empty or not trimmed, or it holds `;`, `!` or an unbalanced string,
 * comment or bracket outside a string, a comment or brackets. Markup targets join declarations
 * with `;`, so a value that ends its own declaration would add another, and object targets
 * would set the property to a value the CSSOM rejects.
 */
export function cssValueProblem(value: string): string | undefined {
  if (value === "") return "must not be empty";
  if (value.trim() !== value) return "must not start or end with whitespace";
  const closing: string[] = [];
  let quote: string | undefined;
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (quote) {
      if (character === "\\") index++;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === "\\") {
      index++;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "/" && value[index + 1] === "*") {
      const end = value.indexOf("*/", index + 2);
      if (end === -1) return "must close its comments";
      index = end + 1;
    } else if (character === "(" || character === "[" || character === "{") {
      closing.push(character === "(" ? ")" : character === "[" ? "]" : "}");
    } else if (character === ")" || character === "]" || character === "}") {
      if (closing.pop() !== character) return "must balance its brackets";
    } else if (closing.length === 0 && (character === ";" || character === "!")) {
      return character === ";"
        ? "must be one value: a `;` ends the declaration"
        : "must not hold `!important`";
    }
  }
  if (quote) return "must close its strings";
  return closing.length ? "must balance its brackets" : undefined;
}
