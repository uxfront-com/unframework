// The attributes Solid 1.9's JSX types do not let an element take, although the analyser and
// the authoring types do (ADR-0037, the way the Qwik target writes its own gaps). Solid
// renders them as written, so the output writes each as an object spread, whose keys
// TypeScript leaves unchecked: `<stop offset="0" {...{ fill: props.colour }} />`. Pinned by
// test/attributes.test.ts, which type-checks every binding the analyser accepts.

const words = (text: string): readonly string[] => text.trim().split(/\s+/);

/** The SVG elements that take no presentation attribute in Solid's types. */
const FILTERS = words(`
  feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting
  feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur
  feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight
  feTile feTurbulence filter
`);

/** The elements whose type lacks each attribute, which SVG's presentation attributes are. */
const UNDECLARED: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries({
    color: [
      ...FILTERS.filter(
        (tag) => !["feDiffuseLighting", "feFlood", "feSpecularLighting"].includes(tag),
      ),
      ...words("clipPath image linearGradient metadata mpath radialGradient view"),
    ],
    cursor: [
      ...FILTERS,
      ...words("clipPath linearGradient metadata mpath radialGradient stop textPath tspan view"),
    ],
    direction: [
      ...FILTERS,
      ...words(
        "circle clipPath defs ellipse g image line linearGradient marker mask metadata mpath path pattern polygon polyline radialGradient rect stop switch symbol view",
      ),
    ],
    display: [
      ...FILTERS,
      ...words(
        "clipPath defs linearGradient marker mask metadata mpath pattern radialGradient stop symbol view",
      ),
    ],
    edgeMode: ["feGaussianBlur"],
    fill: [
      ...FILTERS,
      ...words("clipPath image linearGradient metadata mpath radialGradient stop view"),
    ],
    filter: [
      ...FILTERS,
      ...words(
        "clipPath linearGradient mask metadata mpath radialGradient stop textPath tspan view",
      ),
    ],
    href: ["mpath"],
    lengthAdjust: ["textPath"],
    mask: [
      ...FILTERS,
      ...words("clipPath linearGradient metadata mpath radialGradient stop textPath tspan view"),
    ],
    opacity: [
      ...FILTERS,
      ...words(
        "clipPath linearGradient mask metadata mpath radialGradient stop textPath tspan view",
      ),
    ],
    overflow: [
      ...FILTERS,
      ...words(
        "circle clipPath defs ellipse g line linearGradient mask metadata mpath path polygon polyline radialGradient rect stop switch text textPath tspan view",
      ),
    ],
    stroke: [
      ...FILTERS,
      ...words("clipPath image linearGradient metadata mpath radialGradient stop view"),
    ],
    textLength: ["textPath"],
    transform: [
      ...FILTERS,
      ...words(
        "linearGradient marker mask metadata mpath pattern radialGradient stop svg symbol textPath tspan view",
      ),
    ],
    visibility: [
      ...FILTERS,
      ...words(
        "clipPath defs linearGradient marker mask metadata mpath pattern radialGradient stop symbol view",
      ),
    ],
  }).map(([name, tags]) => [name, new Set(tags)]),
);

/**
 * The attributes Solid's types declare as `never` on an element, to forbid them: `tabindex` on
 * `<dialog>` ("not interactive"). A plain object spread is checked against `never`, so these
 * are spread from an object typed `Record<string, unknown>`.
 */
const FORBIDDEN: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["tabindex", new Set(["dialog"])],
]);

/** Whether Solid's types reject an attribute on an element (see {@link untypedAttribute}). */
export function isUntyped(tag: string, name: string): boolean {
  return Boolean(FORBIDDEN.get(name)?.has(tag) || UNDECLARED.get(name)?.has(tag));
}

/**
 * How an attribute Solid's types reject on an element is written, or `undefined` for one they
 * take as an attribute:
 * - `spread`: `{...{ fill: x }}`, which TypeScript leaves unchecked as long as the element's
 *   other props share a key with its type (`besides`: another attribute it declares, or
 *   children), or it reports the spread as having nothing in common with it (TS2559);
 * - `untyped`: `{...({ fill: x } as Record<string, unknown>)}`, otherwise, and for an attribute
 *   the types forbid.
 *
 * The names are an element's own (SVG's case): every tag here is an SVG element but `<dialog>`.
 */
export function untypedAttribute(
  tag: string,
  name: string,
  besides: boolean,
): "spread" | "untyped" | undefined {
  if (FORBIDDEN.get(name)?.has(tag)) return "untyped";
  if (!UNDECLARED.get(name)?.has(tag)) return undefined;
  return besides ? "spread" : "untyped";
}
