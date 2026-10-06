// Enumerated attributes (ADR-0037): the attributes some target's element types restrict to a
// union of string literals, with no `string` to fall back on. A bound `string` type-checks in the
// source, whose types are Vue's, and fails L4 on the target that lists the tokens (`autocomplete`
// on Svelte and Qwik, `role` on Solid and Astro), so the analyser asks for a value that can only
// be tokens every target accepts (UF3018). The table holds what every typed target accepts:
// Vue's, React's, Solid's, Qwik's, Svelte's and Astro's types, under the name each target prints.
// Angular binds `[attr.x]`, which its compiler does not type. The conformance tests check the
// table against those types with tsgo, both ways: what it accepts every target accepts, and
// every attribute a target restricts is here.

import type { Namespace, Span } from "@unframework/ir";

import { ARIA_ROLES } from "./aria.ts";
import { list } from "./attribute-names.ts";
import type { Problem } from "./attribute-names.ts";
import type { Kinds } from "./types/kinds.ts";

/** The values every typed target accepts for an enumerated attribute. */
export interface Enumerated {
  /** The tokens, in the order the specifications list them. */
  readonly tokens: readonly string[];
  /** Whether every target also accepts a boolean (ARIA's true/false states, `draggable`). */
  readonly boolean: boolean;
}

const words = (text: string): string[] => text.trim().split(/\s+/);

const keywords = (values: string | readonly string[]): Enumerated => ({
  tokens: typeof values === "string" ? words(values) : values,
  boolean: false,
});

/** A true/false state: the targets type it as a boolean or its two strings. */
const BOOLEANISH: Enumerated = { tokens: ["true", "false"], boolean: true };

const orBoolean = (values: string): Enumerated => ({ tokens: words(values), boolean: true });

/**
 * The roles Solid's and Astro's types list: WAI-ARIA 1.1's, without the roles ARIA 1.2 and later
 * added, or those of the DPUB and Graphics modules.
 */
const NEWER_ROLES: ReadonlySet<string> = new Set(
  words(
    "blockquote caption code deletion emphasis generic insertion mark paragraph strong subscript superscript time",
  ),
);

const ROLE = keywords(
  [...ARIA_ROLES].filter(
    (role) => !NEWER_ROLES.has(role) && !role.startsWith("doc-") && !role.startsWith("graphics-"),
  ),
);

/** On HTML and SVG elements alike. */
const SHARED: ReadonlyMap<string, Enumerated> = new Map([
  ["role", ROLE],
  ...words(
    `aria-atomic aria-busy aria-disabled aria-expanded aria-hidden aria-modal aria-multiline
     aria-multiselectable aria-readonly aria-required aria-selected`,
  ).map((name): [string, Enumerated] => [name, BOOLEANISH]),
  ["aria-autocomplete", keywords("inline list both none")],
  ["aria-checked", orBoolean("true false mixed")],
  ["aria-current", orBoolean("page step location date time true false")],
  ["aria-haspopup", orBoolean("false true menu listbox tree grid dialog")],
  ["aria-invalid", orBoolean("grammar false spelling true")],
  ["aria-live", keywords("assertive off polite")],
  ["aria-orientation", keywords("horizontal vertical")],
  ["aria-pressed", orBoolean("true false mixed")],
  [
    "aria-relevant",
    keywords([
      ...words("additions removals text all"),
      "additions removals",
      "additions text",
      "removals additions",
      "removals text",
      "text additions",
      "text removals",
    ]),
  ],
  ["aria-sort", keywords("none ascending descending other")],
]);

/** The autofill tokens Qwik's and Svelte's types list for a form control's `autocomplete`. */
const AUTOFILL = keywords(`
  on off name honorific-prefix given-name additional-name family-name honorific-suffix username
  new-password current-password one-time-code organization street-address address-line1
  address-line2 address-line3 address-level4 address-level3 address-level2 address-level1 country
  country-name postal-code cc-name cc-given-name cc-family-name cc-number cc-exp cc-exp-month
  cc-exp-year cc-csc cc-type transaction-currency transaction-amount bday-day bday-month bday-year
  tel tel-country-code tel-national tel-area-code tel-local tel-local-prefix tel-local-suffix
  tel-extension email
`);

const ENCODINGS = keywords("application/x-www-form-urlencoded multipart/form-data text/plain");
const METHODS = keywords("get post dialog");

/**
 * An HTML attribute's values, on every element that takes it, or by element, where `*` holds
 * them on any element not listed.
 */
const HTML: ReadonlyMap<string, Enumerated | ReadonlyMap<string, Enumerated>> = new Map<
  string,
  Enumerated | ReadonlyMap<string, Enumerated>
>([
  ["autocapitalize", keywords("off none on sentences words characters")],
  [
    "autocomplete",
    new Map([
      ["form", keywords("on off")],
      ["input", AUTOFILL],
      ["select", AUTOFILL],
      ["textarea", AUTOFILL],
    ]),
  ],
  ["autocorrect", keywords("on off")],
  ["capture", keywords("user environment")],
  ["closedby", keywords("any closerequest none")],
  ["contenteditable", keywords("true false inherit")],
  ["crossorigin", keywords(["anonymous", "use-credentials", ""])],
  ["decoding", keywords("async sync auto")],
  // Solid types a <bdo>'s direction without "auto", which it has no meaning on.
  [
    "dir",
    new Map([
      ["*", keywords("ltr rtl auto")],
      ["bdo", keywords("ltr rtl")],
    ]),
  ],
  ["draggable", { tokens: [], boolean: true }],
  ["enctype", ENCODINGS],
  ["enterkeyhint", keywords("enter done go next previous search send")],
  ["fetchpriority", keywords("high low auto")],
  ["formenctype", ENCODINGS],
  ["formmethod", METHODS],
  ["inputmode", keywords("none text tel url email numeric decimal search")],
  ["kind", keywords("subtitles captions descriptions chapters metadata")],
  ["loading", keywords("eager lazy")],
  ["method", METHODS],
  ["popover", keywords("auto manual")],
  ["popovertargetaction", keywords("toggle show hide")],
  ["preload", keywords(["none", "metadata", "auto", ""])],
  [
    "referrerpolicy",
    keywords(
      `no-referrer no-referrer-when-downgrade origin origin-when-cross-origin same-origin
       strict-origin strict-origin-when-cross-origin unsafe-url`,
    ),
  ],
  ["scope", keywords("row col rowgroup colgroup")],
  ["shape", keywords("rect circle poly default")],
  ["spellcheck", { tokens: [], boolean: true }],
  ["translate", keywords("yes no")],
  [
    "type",
    new Map([
      ["button", keywords("submit reset button")],
      // Astro's types list HTML's input types.
      [
        "input",
        keywords(
          `button checkbox color date datetime-local email file hidden image month number password
           radio range reset search submit tel text time url week`,
        ),
      ],
      ["ol", keywords("1 a A i I")],
    ]),
  ],
  ["wrap", keywords("hard soft off")],
  ["writingsuggestions", keywords("true false")],
]);

const UNITS = keywords("userSpaceOnUse objectBoundingBox");
const TRANSFER = keywords("identity table discrete linear gamma");
const ALIGNMENTS = ["xMin", "xMid", "xMax"].flatMap((x) =>
  ["YMin", "YMid", "YMax"].map((y) => `${x}${y}`),
);

/**
 * An SVG attribute's values, on every element that takes it, or by element. Solid types the
 * presentation attributes of some elements only: these keywords are what the attribute takes on
 * any element.
 */
const SVG: ReadonlyMap<string, Enumerated | ReadonlyMap<string, Enumerated>> = new Map<
  string,
  Enumerated | ReadonlyMap<string, Enumerated>
>([
  [
    "alignment-baseline",
    keywords(
      `auto baseline before-edge text-before-edge middle central after-edge text-after-edge
       ideographic alphabetic hanging mathematical inherit`,
    ),
  ],
  ["clip-rule", keywords("nonzero evenodd inherit")],
  ["clipPathUnits", UNITS],
  ["color-interpolation", keywords("auto sRGB linearRGB inherit")],
  ["color-interpolation-filters", keywords("auto inherit")],
  ["direction", keywords("ltr rtl inherit")],
  [
    "dominant-baseline",
    keywords("auto alphabetic ideographic middle central mathematical hanging inherit"),
  ],
  ["edgeMode", keywords("duplicate wrap none")],
  ["fill-rule", keywords("nonzero evenodd inherit")],
  ["filterUnits", UNITS],
  ["font-style", keywords("normal italic oblique inherit")],
  ["gradientUnits", UNITS],
  ["image-rendering", keywords("auto optimizeSpeed optimizeQuality inherit")],
  ["lengthAdjust", keywords("spacing spacingAndGlyphs")],
  ["markerUnits", keywords("strokeWidth userSpaceOnUse")],
  ["maskContentUnits", UNITS],
  ["maskUnits", UNITS],
  ["method", keywords("align stretch")],
  ["mode", keywords("normal multiply screen darken lighten")],
  [
    "operator",
    new Map([
      ["feComposite", keywords("over in out atop xor arithmetic")],
      ["feMorphology", keywords("erode dilate")],
    ]),
  ],
  ["overflow", keywords("visible hidden scroll auto inherit")],
  ["patternContentUnits", UNITS],
  ["patternUnits", UNITS],
  [
    "pointer-events",
    keywords(
      "bounding-box visiblePainted visibleFill visibleStroke visible painted fill stroke all none inherit",
    ),
  ],
  ["preserveAlpha", keywords("true false")],
  [
    "preserveAspectRatio",
    keywords([
      "none",
      ...ALIGNMENTS.flatMap((alignment) => [alignment, `${alignment} meet`, `${alignment} slice`]),
    ]),
  ],
  ["primitiveUnits", UNITS],
  ["shape-rendering", keywords("auto optimizeSpeed crispEdges geometricPrecision inherit")],
  ["spacing", keywords("auto exact")],
  ["spreadMethod", keywords("pad reflect repeat")],
  ["stitchTiles", keywords("stitch noStitch")],
  ["stroke-linecap", keywords("butt round square inherit")],
  ["stroke-linejoin", keywords("miter round bevel inherit")],
  ["text-anchor", keywords("start middle end inherit")],
  ["text-decoration", keywords("none underline overline line-through blink inherit")],
  ["text-rendering", keywords("auto optimizeSpeed optimizeLegibility geometricPrecision inherit")],
  [
    "type",
    new Map([
      ["feColorMatrix", keywords("matrix saturate hueRotate luminanceToAlpha")],
      ["feFuncA", TRANSFER],
      ["feFuncB", TRANSFER],
      ["feFuncG", TRANSFER],
      ["feFuncR", TRANSFER],
      ["feTurbulence", keywords("fractalNoise turbulence")],
    ]),
  ],
  ["visibility", keywords("visible hidden collapse inherit")],
  ["writing-mode", keywords("lr-tb rl-tb tb-rl lr rl tb inherit")],
  ["xChannelSelector", keywords("R G B A")],
  ["yChannelSelector", keywords("R G B A")],
]);

/** The values every typed target accepts for an attribute of an element, if they are listed. */
export function enumeratedValues(
  tag: string,
  namespace: Namespace,
  name: string,
): Enumerated | undefined {
  return lookup(tag, namespace, name)?.values;
}

/** An attribute's values, and whether they depend on the element (`type`, `autocomplete`). */
function lookup(
  tag: string,
  namespace: Namespace,
  name: string,
): { values: Enumerated; byElement: boolean } | undefined {
  const shared = SHARED.get(name);
  if (shared) return { values: shared, byElement: false };
  const entry = (namespace === "svg" ? SVG : HTML).get(name);
  if (!entry) return undefined;
  if ("tokens" in entry) return { values: entry, byElement: false };
  const own = entry.get(tag);
  if (own) return { values: own, byElement: true };
  const values = entry.get("*");
  return values && { values, byElement: false };
}

/** How many tokens a message lists before it counts the rest. */
const LISTED = 12;

/** The accepted values, for a message: the tokens (the first `LISTED`), and a boolean. */
function accepted(tokens: readonly string[], boolean: boolean): string {
  const quoted = tokens.map((token) => JSON.stringify(token));
  return list(
    [
      ...(quoted.length > LISTED
        ? [...quoted.slice(0, LISTED), `${quoted.length - LISTED} more`]
        : quoted),
      ...(boolean ? ["a boolean"] : []),
    ],
    "or",
  );
}

/**
 * A bound value an enumerated attribute's types do not accept on every target (UF3018): any
 * string, a literal some target does not list, a number, or a boolean where one is not accepted.
 * A value of unknown kind is accepted (ADR-0035).
 */
export function enumeratedProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  kinds: Kinds,
): Problem | undefined {
  const found = lookup(tag, namespace, name);
  if (!found) return undefined;
  const { values } = found;
  const outside: string[] = [];
  if (kinds.primitives.has("string")) {
    if (!kinds.strings) outside.push("any string");
    else {
      for (const value of kinds.strings) {
        if (!values.tokens.includes(value)) outside.push(JSON.stringify(value));
      }
    }
  }
  if (kinds.primitives.has("number")) outside.push("a number");
  if (kinds.primitives.has("boolean") && !values.boolean) outside.push("a boolean");
  if (!outside.length) return undefined;
  const quoted = values.tokens.map((token) => JSON.stringify(token));
  const element = found.byElement ? ` on <${tag}>` : "";
  return {
    code: "UF3018",
    message: `Some targets' types accept only ${accepted(values.tokens, values.boolean)} for \`${name}\`${element}, and this value can be ${list(outside, "or")}.`,
    help: quoted.length
      ? `Bind one of the listed values, or a union of them: \`cond ? ${quoted[0]} : ${quoted[1] ?? quoted[0]}\`.`
      : "Bind a boolean.",
  };
}

/**
 * The static values a target converts itself, which its types would reject as written, and the
 * others' types take: Qwik writes a static `draggable` or `spellcheck` of "true" or "false" as
 * the boolean its types take (the Qwik target's `qwikStaticValue`), and a `contenteditable` of
 * "plaintext-only" under its HTML name in an object spread, which its types do not check.
 */
const CONVERTED: ReadonlyMap<string, readonly string[]> = new Map([
  ["contenteditable", ["plaintext-only"]],
  ["draggable", ["true", "false"]],
  ["spellcheck", ["true", "false"]],
]);

/**
 * The keyword HTML reads an empty value as, where one does: `spellcheck=""` is on, and a
 * `<button>`'s invalid `type` is a submit button.
 */
function emptyMeaning(tag: string, name: string): string | undefined {
  if (name === "type") return tag === "button" ? "submit" : tag === "input" ? "text" : undefined;
  return EMPTY_MEANS.get(name);
}

const EMPTY_MEANS: ReadonlyMap<string, string> = new Map([
  ["autocorrect", "on"],
  ["contenteditable", "true"],
  ["popover", "auto"],
  ["spellcheck", "true"],
  ["translate", "yes"],
]);

/**
 * The value an attribute written without one is given: the empty string HTML reads it as, or,
 * where the targets' types take no empty value, the keyword HTML reads that as (`popover="auto"`).
 */
export function emptyValue(tag: string, namespace: Namespace, name: string): string {
  const tokens = staticTokens(tag, namespace, name);
  if (!tokens || tokens.includes("") || namespace !== "html") return "";
  return emptyMeaning(tag, name) ?? "";
}

/** The static values every typed target accepts for an attribute of an element, if listed. */
export function staticTokens(
  tag: string,
  namespace: Namespace,
  name: string,
): readonly string[] | undefined {
  const found = lookup(tag, namespace, name);
  if (!found) return undefined;
  const converted = namespace === "html" ? CONVERTED.get(name) : undefined;
  return converted ? [...found.values.tokens, ...converted] : found.values.tokens;
}

/**
 * Whether HTML reads the attribute's keywords in any case: an HTML enumerated attribute's, and
 * ARIA's tokens, but not a role, or an ordered list's `type` ("a" and "A" differ). SVG's are
 * case-sensitive.
 */
function caseInsensitive(tag: string, namespace: Namespace, name: string): boolean {
  return namespace === "html" && name !== "role" && !(tag === "ol" && name === "type");
}

/**
 * A static value of an enumerated attribute some typed target's types reject (ADR-0037): a
 * keyword in another case, or an empty value HTML reads as a keyword, is written as that keyword
 * (UF3004, fixed at `value`, the attribute's written value); any other value is UF3008.
 */
export function enumeratedStaticProblem(
  tag: string,
  namespace: Namespace,
  name: string,
  value: string,
  at: Span | undefined,
): Problem | undefined {
  const found = lookup(tag, namespace, name);
  const tokens = staticTokens(tag, namespace, name);
  if (!found || !tokens || tokens.includes(value)) return undefined;
  const lower = value.toLowerCase();
  const canonical =
    namespace === "html" && value === ""
      ? emptyMeaning(tag, name)
      : caseInsensitive(tag, namespace, name)
        ? tokens.find((token) => token.toLowerCase() === lower)
        : undefined;
  if (canonical !== undefined && tokens.includes(canonical)) {
    return {
      code: "UF3004",
      message: `\`${name}="${value}"\` is written \`${name}="${canonical}"\`: HTML reads ${value === "" ? "an empty value as" : "the keyword in any case, and the targets' types take"} "${canonical}".`,
      fixes: at
        ? [
            {
              title: `Write "${canonical}"`,
              confidence: "safe",
              edits: [{ span: at, text: `"${canonical}"` }],
            },
          ]
        : [],
    };
  }
  const element = found.byElement ? ` on <${tag}>` : "";
  return {
    code: "UF3008",
    message: `Some targets' types accept only ${accepted(tokens, false)} for \`${name}\`${element}, and "${value}" is not one.`,
    help: "Write one of the listed values.",
  };
}
