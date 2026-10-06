import { cssPropertiesOverlap } from "@unframework/ir";

/**
 * The `style` attribute as a list of declarations. The parser is deliberately small: it splits
 * on `;` and `:` outside strings, parentheses, escapes and comments, which is all a declaration
 * list needs. Values are not interpreted (`0` and `0px` stay different): the targets render
 * the same source values, so only their formatting differs.
 */
export interface Declaration {
  /** Lowercase, except custom properties (`--x`), which are case-sensitive. */
  property: string;
  /** Whitespace collapsed outside strings; `undefined` for a chunk without a colon. */
  value: string | undefined;
  important: boolean;
}

/** CSS whitespace (not every Unicode space: U+00A0 is part of a value). */
const CSS_SPACE = /[ \t\n\r\f]/;

/**
 * Walks `text` outside strings, escapes and comments (which become one space), calling
 * `onChar` for each top-level character with the current parenthesis depth. Returns the text
 * with comments replaced.
 */
function scan(text: string, onChar: (char: string, depth: number, out: string) => string): string {
  let out = "";
  let quote = "";
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (char === "\\" && index + 1 < text.length) {
      out += char + text[++index];
    } else if (quote) {
      out += char;
      if (char === quote) quote = "";
    } else if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end === -1 ? text.length : end + 1;
      out = onChar(" ", depth, out);
    } else {
      if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth++;
      else if (char === ")" && depth > 0) depth--;
      out = onChar(char, depth, out);
    }
  }
  return out;
}

/** Splits at top-level `separator`s, at most `limit` parts. */
function split(text: string, separator: string, limit: number): string[] {
  const parts: string[] = [];
  const last = scan(text, (char, depth, out) => {
    if (char === separator && depth === 0 && parts.length < limit - 1) {
      parts.push(out);
      return "";
    }
    return out + char;
  });
  parts.push(last);
  return parts;
}

/** Collapses runs of whitespace outside strings to one space, and trims. */
function collapse(text: string): string {
  return scan(text, (char, _depth, out) =>
    CSS_SPACE.test(char) ? (out.endsWith(" ") ? out : `${out} `) : out + char,
  ).trim();
}

const IMPORTANT = /\s*!\s*important$/i;

/** Parses a declaration list (the value of a `style` attribute). */
export function parseStyle(text: string): Declaration[] {
  const declarations: Declaration[] = [];
  for (const chunk of split(text, ";", Number.POSITIVE_INFINITY)) {
    if (collapse(chunk) === "") continue;
    const [name, rest] = split(chunk, ":", 2);
    if (rest === undefined) {
      declarations.push({ property: collapse(chunk), value: undefined, important: false });
      continue;
    }
    const property = collapse(name!);
    const value = collapse(rest);
    const important = IMPORTANT.test(value);
    declarations.push({
      property: property.startsWith("--") ? property : property.toLowerCase(),
      value: important ? value.replace(IMPORTANT, "") : value,
      important,
    });
  }
  return declarations;
}

/**
 * Drops each declaration a later one overrides, as the cascade inside one block does: the later
 * declaration of a property wins unless only the earlier one is `!important`. The winner keeps
 * its own position, as in the CSSOM. Order is otherwise kept, because shorthands and longhands
 * (`margin` and `margin-top`) make it significant.
 *
 * It assumes every declaration is valid, which only a browser can check, so it only reads
 * values (`styleValue`, the Angular host check) and never rewrites a `style` attribute.
 */
export function dedupeDeclarations(declarations: readonly Declaration[]): Declaration[] {
  const winners = new Map<string, Declaration>();
  for (const declaration of declarations) {
    if (declaration.value === undefined) continue;
    const previous = winners.get(declaration.property);
    if (!previous || declaration.important || !previous.important) {
      winners.set(declaration.property, declaration);
    }
  }
  return declarations.filter(
    (declaration) =>
      declaration.value === undefined || winners.get(declaration.property) === declaration,
  );
}

/**
 * Prints declarations the way the CSSOM serialises `style.cssText`: `property: value;`,
 * separated by one space, with ` !important` before the semicolon.
 */
export function printStyle(declarations: readonly Declaration[]): string {
  return declarations
    .map(({ property, value, important }) =>
      value === undefined
        ? `${property};`
        : `${property}: ${value}${important ? " !important" : ""};`,
    )
    .join(" ");
}

/**
 * The lowercased value of the last applying declaration of any of `properties` (a shorthand
 * and its longhand: whichever comes last wins), if any.
 */
export function styleValue(
  style: string | undefined,
  ...properties: readonly string[]
): string | undefined {
  if (style === undefined) return undefined;
  return dedupeDeclarations(parseStyle(style))
    .findLast((declaration) => properties.includes(declaration.property))
    ?.value?.toLowerCase();
}

/**
 * Sorts declarations by property name, unless the order of two of them decides what renders
 * (`cssPropertiesOverlap` of `@unframework/ir`: the same property, a shorthand and one of its
 * longhands, two shorthands that share one, `all`, or a flow-relative longhand and a physical
 * one that can be the same): then it keeps them as they are. A declaration list without such a
 * pair renders the same in any order, and the targets write it in theirs (an object's key order,
 * the CSSOM's, or static declarations first).
 */
export function sortDeclarations(declarations: readonly Declaration[]): Declaration[] {
  const ordered = declarations.some((declaration, index) =>
    declarations
      .slice(index + 1)
      .some((other) => cssPropertiesOverlap(declaration.property, other.property)),
  );
  // By UTF-16 code units, so the order never depends on a locale.
  return ordered
    ? [...declarations]
    : declarations.toSorted((a, b) =>
        a.property < b.property ? -1 : a.property > b.property ? 1 : 0,
      );
}
