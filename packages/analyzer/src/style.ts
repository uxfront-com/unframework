// `style` (ADR-0038): a static declaration list (`style="color: red"`) or an object
// (`style={{ color: tone, marginTop: "4px" }}`), lowered to declarations. The present ones
// render in no particular order, so no two may set what the other sets, and every value is one
// the targets write alike.

import type { Fix } from "@unframework/diagnostics";
import {
  angularLowercases,
  angularMisreads,
  createBoundStyle,
  createStaticStyle,
  createStyleAttribute,
  CSS_PROPERTIES,
  cssPropertiesOverlap,
  cssValueProblem,
  isCssPropertyName,
  isCustomProperty,
  UNITLESS_PROPERTIES,
} from "@unframework/ir";
import type { Span, StyleAttribute, StyleDeclaration } from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { parseDeclarations } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import { checkExpression, span } from "./expressions.ts";
import type { Piece } from "./jsx/text.ts";
import { isStaticString, reportCharacters, valueOf } from "./literals.ts";
import type { RenderContext } from "./render.ts";
import { describe, outside } from "./types/kinds.ts";

/** The `display` values that make a table-internal box (ADR-0031): the parser repairs them. */
const TABLE_DISPLAYS: ReadonlySet<string> = new Set([
  "table-caption",
  "table-cell",
  "table-column",
  "table-column-group",
  "table-footer-group",
  "table-header-group",
  "table-row",
  "table-row-group",
]);

/**
 * The standard properties react-dom 19.3 writes a number to without a unit (`unitlessNumbers`)
 * and Qwik 2.0 beta with `px`: SVG's stroke and opacity properties. On the properties in
 * neither list (`UNITLESS_PROPERTIES` holds those in both), both add `px`.
 */
const REACT_UNITLESS: ReadonlySet<string> = new Set([
  "fill-opacity",
  "flood-opacity",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
]);

/** A `style` lowered: the attribute, when nothing in it was reported. */
export interface LoweredStyle {
  attribute: StyleAttribute | undefined;
  /** Whether the style sets nothing, which renders as no `style` attribute. */
  empty: boolean;
  /** Whether a value is bound: written as anything but a string literal. */
  binds: boolean;
}

/** The declarations seen so far, for the overlap check. */
class Declarations {
  readonly #seen: { property: string; at: Span }[] = [];
  readonly declarations: StyleDeclaration[] = [];

  /** Reports a property another declaration sets already, or overlaps (UF3022). */
  claim(property: string, at: Span, reporter: Reporter): void {
    const other = this.#seen.find((seen) => cssPropertiesOverlap(seen.property, property));
    this.#seen.push({ property, at });
    if (!other) return;
    reporter.report(
      "UF3022",
      at,
      other.property === property
        ? `This \`style\` sets \`${property}\` twice: the targets that write a style as an object keep one.`
        : `This \`style\` sets \`${property}\` and \`${other.property}\`, which set the same thing: the targets that write a style as an object cannot keep the order that decides it.`,
      {
        help: "Set each property once, with its final value.",
        related: [{ span: other.at, message: "Also set here" }],
      },
    );
  }
}

/**
 * Lowers a static declaration list, `style="…"` (decoded from the attribute string, whose pieces
 * map it back to the source) or `style={"…"}`.
 */
export function lowerStaticStyle(
  value: string,
  pieces: readonly Piece[],
  at: Span,
  reporter: Reporter,
): LoweredStyle {
  const mark = reporter.diagnostics.length;
  const where = mapper(value, pieces, at);
  const parsed = parseDeclarations(value);
  for (const error of parsed.errors) {
    reporter.report(
      "UF3022",
      where(error.span),
      `This \`style\` is not valid CSS: ${error.message}.`,
      {
        help: "Write declarations as `property: value`, separated by `;`.",
      },
    );
  }
  if (parsed.errors.length) return { attribute: undefined, empty: false, binds: false };
  if (!parsed.declarations.length) return { attribute: undefined, empty: true, binds: false };
  const declarations = new Declarations();
  for (const declaration of parsed.declarations) {
    const property = propertyOf(declaration.property, where(declaration.propertySpan), reporter);
    if (property === undefined) continue;
    declarations.claim(property, where(declaration.propertySpan), reporter);
    if (staticValueProblem(property, declaration.value, where(declaration.valueSpan), reporter)) {
      continue;
    }
    declarations.declarations.push(
      createStaticStyle(property, declaration.value, where(declaration.span)),
    );
  }
  return {
    attribute: reporter.hasErrorsSince(mark)
      ? undefined
      : createStyleAttribute(declarations.declarations, at),
    empty: false,
    binds: false,
  };
}

/** Maps a span of a decoded value back to the source, through the pieces that wrote it. */
function mapper(value: string, pieces: readonly Piece[], at: Span): (range: Span) => Span {
  // Each UTF-16 unit of the value, and the piece that wrote it.
  const origins: Piece[] = [];
  for (const piece of pieces)
    for (let unit = 0; unit < piece.value.length; unit++) origins.push(piece);
  return (range) => {
    if (origins.length !== value.length) return at;
    const first = origins[range.start];
    const last = origins[range.end - 1];
    if (range.start === range.end) {
      const offset = first?.start ?? origins.at(-1)?.end ?? at.start;
      return { start: offset, end: offset };
    }
    return { start: first!.start, end: last!.end };
  };
}

/**
 * A declaration's property as the IR holds it: lower case, or a custom property as written.
 * Reports a vendor prefix (UF1002, deferred to M4 by ADR-0038), a name that is no property, or
 * a custom property with an upper-case letter (UF3022).
 */
function propertyOf(written: string, at: Span, reporter: Reporter): string | undefined {
  if (isCustomProperty(written)) {
    return lowerCaseCustomProperty(written, at, reporter) ? written : undefined;
  }
  const property = written.toLowerCase();
  if (isCssPropertyName(property)) {
    if (CSS_PROPERTIES.has(property)) return property;
    reportUnknownProperty(written, property, at, reporter);
    return undefined;
  }
  if (property.startsWith("-")) {
    reporter.unsupported(
      at,
      `Vendor-prefixed properties such as \`${written}\` are not supported yet: the targets prefix them differently. They land in M4.`,
      { help: "Write the standard property." },
    );
  } else {
    reporter.report("UF3022", at, `\`${written}\` is not a CSS property name.`);
  }
  return undefined;
}

/**
 * Reports a custom property with an upper-case letter (UF3022), and returns whether it is in
 * lower case. Custom properties are case-sensitive, but Angular's compiler and its server DOM
 * lowercase every property they parse (`--Gap` becomes `--gap`), so `var(--Gap)` would not find
 * it there.
 */
function lowerCaseCustomProperty(property: string, at: Span, reporter: Reporter): boolean {
  if (!angularLowercases(property)) return true;
  reporter.report(
    "UF3022",
    at,
    `\`${property}\` has an upper-case letter, and Angular's server renderer lowercases a custom property's name.`,
    {
      help: `Write \`${property.toLowerCase()}\`, and read it as \`var(${property.toLowerCase()})\`.`,
    },
  );
  return false;
}

/**
 * Reports a property name no browser knows (UF3022): almost always a typo, which no browser
 * applies and Solid's lint rejects. The help names the known property one edit or two away.
 */
function reportUnknownProperty(
  written: string,
  property: string,
  at: Span,
  reporter: Reporter,
): void {
  const near = nearestProperty(property);
  reporter.report("UF3022", at, `\`${written}\` is not a CSS property: no browser applies it.`, {
    help: near
      ? `Did you mean \`${near}\`?`
      : "Write a CSS property, or a custom property (`--name`) for your own value.",
  });
}

/** The known property closest to a name, at most two edits away, if there is one. */
function nearestProperty(name: string): string | undefined {
  let best: string | undefined;
  let distance = 3;
  for (const property of CSS_PROPERTIES) {
    if (Math.abs(property.length - name.length) >= distance) continue;
    const found = editDistance(name, property);
    if (found < distance) {
      best = property;
      distance = found;
    }
  }
  return best;
}

/** Levenshtein distance. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** Reports a static value the targets cannot write alike, and returns whether it did. */
function staticValueProblem(
  property: string,
  value: string,
  at: Span,
  reporter: Reporter,
): boolean {
  if (/!\s*important\s*$/i.test(value)) {
    reporter.report(
      "UF3022",
      at,
      `\`${property}\` is \`!important\`, which React's and Solid's style objects drop.`,
      { help: "Remove `!important`, and raise the rule's specificity in a stylesheet instead." },
    );
    return true;
  }
  const problem = cssValueProblem(value);
  if (problem) {
    reporter.report(
      "UF3022",
      at,
      value === ""
        ? `\`${property}\` has no value.`
        : `\`${property}\`'s value ${problem}: the targets write each value into a declaration of their own.`,
      { help: "Write one CSS value." },
    );
    return true;
  }
  if (angularMisreads(value)) {
    reporter.report(
      "UF3022",
      at,
      `Angular's style parser reads \`${property}\`'s value differently: it knows neither escapes nor comments, and counts the parentheses inside strings.`,
      {
        help: 'Put the other quote around a string that holds a quote (`\'a"b\'`), write a parenthesis inside a string as an escape (`"\\28"`), and leave out comments that hold a quote, a parenthesis or a `;`.',
      },
    );
    return true;
  }
  if (
    property === "display" &&
    value
      .toLowerCase()
      .split(/\s+/)
      .some((keyword) => TABLE_DISPLAYS.has(keyword))
  ) {
    reporter.unsupported(
      at,
      "A `display` that makes a table part is not supported yet: the HTML parser and the targets lay table parts out differently outside a table. It lands in M4.",
      { help: "Use a table's own elements." },
    );
    return true;
  }
  return false;
}

/** A style object's key's property: camel case for standard properties, quoted custom ones. */
function keyProperty(key: string): { property: string; kebab: boolean; vendor: boolean } {
  if (key.startsWith("--")) return { property: key, kebab: false, vendor: false };
  if (key.includes("-")) {
    return { property: key.toLowerCase(), kebab: true, vendor: key.startsWith("-") };
  }
  const vendor = /^(Webkit|Moz|ms|O)[A-Z]/.test(key);
  return {
    property: key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    kebab: false,
    vendor,
  };
}

/** `margin-top` as a style object's key: `marginTop`. */
function camelCase(property: string): string {
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Lowers `style={{ … }}`. */
export function lowerStyleObject(node: AST.ObjectExpression, context: RenderContext): LoweredStyle {
  const { reporter, source } = context;
  const mark = reporter.diagnostics.length;
  const declarations = new Declarations();
  const properties = node.properties.flatMap((property) => {
    if (
      property.type === "SpreadElement" ||
      property.computed ||
      property.method ||
      property.kind !== "init"
    ) {
      reporter.report(
        "UF3022",
        property.type === "SpreadElement" ? property : property.key,
        property.type === "SpreadElement"
          ? "A `style` object cannot spread another object: the targets write each declaration they can see."
          : property.computed
            ? "A `style` object's keys are CSS properties: no computed keys."
            : "A `style` object's values are CSS values: no methods, getters or setters.",
        { help: 'Write each property as a key: `{ marginTop: gap, "--gap": size }`.' },
      );
      return [];
    }
    const { key } = property;
    const name =
      key.type === "Identifier"
        ? key.name
        : key.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    if (name === undefined) {
      reporter.report(
        "UF3022",
        key,
        "A `style` object's keys are CSS properties: write them as names or strings.",
      );
      return [];
    }
    return [{ property, key, name, read: keyProperty(name) }];
  });
  const counts = new Map<string, number>();
  for (const { read } of properties)
    counts.set(read.property, (counts.get(read.property) ?? 0) + 1);
  for (const { property, key, name, read } of properties) {
    const at = span(key);
    if (read.vendor) {
      reporter.unsupported(
        at,
        `Vendor-prefixed properties such as \`${name}\` are not supported yet: the targets prefix them differently. They land in M4.`,
        { help: "Write the standard property." },
      );
      continue;
    }
    if (!isCssPropertyName(read.property)) {
      reporter.report("UF3022", at, `\`${name}\` is not a CSS property name.`);
      continue;
    }
    if (!isCustomProperty(read.property) && !CSS_PROPERTIES.has(read.property)) {
      reportUnknownProperty(name, read.property, at, reporter);
      continue;
    }
    if (isCustomProperty(read.property) && !lowerCaseCustomProperty(read.property, at, reporter)) {
      continue;
    }
    if (read.kebab) {
      const camel = camelCase(read.property);
      // A rename that would set a property twice changes which value wins: no fix then.
      const fixes: Fix[] =
        counts.get(read.property) === 1 && !property.shorthand
          ? [
              {
                title: `Write \`${camel}\``,
                confidence: "safe",
                edits: [{ span: at, text: camel }],
              },
            ]
          : [];
      reporter.report(
        "UF3004",
        at,
        `The style key for \`${read.property}\` is written \`${camel}\`: style objects take camel-case keys, as React's and Vue's do.`,
        { fixes },
      );
    }
    declarations.claim(read.property, at, reporter);
    const value = property.value;
    if (isStaticString(value)) {
      const text = valueOf(value).trim();
      if (reportCharacters(value, source, reporter)) continue;
      if (staticValueProblem(read.property, text, span(value), reporter)) continue;
      declarations.declarations.push(createStaticStyle(read.property, text, span(property)));
      continue;
    }
    // React and Qwik leave a 0 bare, as every other target does: `margin: 0` is `margin: 0`.
    if (
      value.type === "Literal" &&
      value.value === 0 &&
      !isCustomProperty(read.property) &&
      !UNITLESS_PROPERTIES.has(read.property)
    ) {
      declarations.declarations.push(createStaticStyle(read.property, "0", span(property)));
      continue;
    }
    const checked = checkExpression(value, context);
    const kinds = outside(
      checked.kinds,
      isCustomProperty(read.property) || UNITLESS_PROPERTIES.has(read.property)
        ? ["string", "number", "null", "undefined"]
        : ["string", "null", "undefined"],
    );
    if (kinds.length) {
      const number =
        kinds.includes("number") &&
        value.type === "Literal" &&
        typeof value.value === "number" &&
        kinds.length === 1;
      // React leaves a number on SVG's stroke and opacity properties bare, as their CSS does,
      // so its meaning there is the number as a string.
      const bare = REACT_UNITLESS.has(read.property);
      const fixed = number ? `"${String(value.value)}${bare ? "" : "px"}"` : "";
      reporter.report(
        "UF3018",
        value,
        kinds.includes("number")
          ? `A number on \`${read.property}\` renders with \`px\` on ${bare ? "Qwik" : "React and Qwik"} and without a unit on the others.`
          : `A style value renders as a CSS value, and this one can be ${describe(kinds)}, which the targets render differently.`,
        {
          help: kinds.includes("number")
            ? bare
              ? 'Write it as a string: `"2"`, or `String(width)`.'
              : 'Write the unit: `"4px"`, or a template literal such as `` `${gap}px` ``.'
            : "Write a string, or `undefined` to leave the declaration out.",
          ...(number
            ? {
                fixes: [
                  {
                    title: `Write \`${fixed}\``,
                    confidence: "likely" as const,
                    edits: [{ span: span(value), text: fixed }],
                  },
                ],
              }
            : {}),
        },
      );
      continue;
    }
    declarations.declarations.push(
      createBoundStyle(read.property, checked.expression, span(property)),
    );
  }
  // As written once fixed: a number its fix writes with `px` is a static string then.
  const binds =
    properties.length !== node.properties.length ||
    properties.some(
      ({ property, read }) =>
        !isStaticString(property.value) &&
        !(
          property.value.type === "Literal" &&
          typeof property.value.value === "number" &&
          !isCustomProperty(read.property) &&
          !UNITLESS_PROPERTIES.has(read.property)
        ),
    );
  if (reporter.hasErrorsSince(mark)) return { attribute: undefined, empty: false, binds };
  if (!properties.length) return { attribute: undefined, empty: true, binds };
  return {
    attribute: createStyleAttribute(declarations.declarations, span(node)),
    empty: false,
    binds,
  };
}
