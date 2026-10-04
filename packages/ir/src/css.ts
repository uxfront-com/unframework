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

/** Whether a name is a custom property, `--gap`: two hyphens and ASCII name characters. */
export function isCustomProperty(name: string): boolean {
  return /^--[A-Za-z0-9_-]+$/.test(name);
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
