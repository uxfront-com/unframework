// What the markup dialects share to write text, attribute values and expression code so that each
// template compiler reads back exactly what was meant (ADR-0026, design §4.3). Expression code is
// read token by token (oxc, through the rewrite engine's parser): a template scanner that looks
// inside expressions (Vue's `}}`, Angular's lexer) must not see its delimiters in a string,
// a regular expression or a comment, and a rewrite must not change what a literal means.
import { parseExpressionSource } from "../rewrite.ts";

/**
 * Text as HTML reads it back: `&` and `<` as references, no-break spaces visible, and carriage
 * returns as references, because HTML turns a raw one into a line feed.
 */
export const escapeHtmlText = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\u00a0/g, "&nbsp;")
    .replace(/\r/g, "&#13;");

/** A double-quoted attribute value, with the same references as text plus `"`. */
export const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\u00a0/g, "&nbsp;")
    .replace(/\r/g, "&#13;");

/** Each UTF-16 code unit of the text as a `\uXXXX` escape. */
export const unicodeEscape = (text: string): string =>
  text.replace(/[\s\S]/g, (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`);

/**
 * A string literal for a template expression (`{{ … }}`, `{…}`): JSON escaping, plus `\u`
 * escapes for what the template's own scanner would read before the expression parser does.
 * Vue and Angular decode entities inside `{{ }}` and Vue ends one at the first `}}`, Angular
 * and HTML-aware tools see markup in `<` and `>`, and line separators are line breaks to some
 * JavaScript tools.
 */
export const stringLiteral = (text: string): string =>
  JSON.stringify(text).replace(/[&<>{}\u2028\u2029]/g, unicodeEscape);

/** `name="value"`, escaped as HTML reads it back. */
export const quotedAttribute = (name: string, value: string): string =>
  `${name}="${escapeHtmlAttribute(value)}"`;

/** `{` and `}` as references, which Svelte, Astro and Angular would read as syntax. */
export function escapeBraces(text: string): string {
  return text.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

/**
 * Code inside markup that decodes character references (Vue's and Angular's interpolations and
 * attribute values): an `&` that could start one (`&amp;`, `&lt` without its semicolon, which
 * HTML's legacy references decode, `&#38;`) is written `&amp;`. One followed by anything else
 * (`a && b`) stays as written: no reference starts there.
 */
export function escapeReferences(code: string): string {
  return code.replace(/&(?=[A-Za-z0-9#])/g, "&amp;");
}

/** A name in kebab case as a camel-case style key (`margin-top` → `marginTop`). */
export function camelCaseProperty(property: string): string {
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Whether a name can be written as an identifier key or after a dot (ASCII, as the IR's). */
export function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/** A token of expression code whose text a template scanner may read differently. */
export type CodeToken =
  | { kind: "string"; start: number; end: number; value: string }
  | {
      kind: "template";
      /** The quasi's own text, between its delimiters (`` ` ``, `${`, `}`). */
      start: number;
      end: number;
      cooked: string;
    }
  | { kind: "regex"; start: number; end: number }
  | { kind: "number"; start: number; end: number; value: number }
  | { kind: "comment"; start: number; end: number };

/**
 * What {@link mapCode} does with each kind of token, and with the code between tokens. Each
 * function also gets the output so far, for a rule that spans two tokens.
 */
export interface CodeMap {
  string?(raw: string, token: CodeToken & { kind: "string" }, before: string): string;
  template?(raw: string, token: CodeToken & { kind: "template" }, before: string): string;
  regex?(raw: string, before: string): string;
  number?(raw: string, token: CodeToken & { kind: "number" }, before: string): string;
  comment?(raw: string, before: string): string;
  /** The code between tokens: punctuation, names and the template literals' delimiters. */
  other?(text: string, before: string): string;
}

/** A node of oxc's AST, as far as the scan reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string" &&
    typeof (value as { start?: unknown }).start === "number"
  );
}

/** A template literal's quasi value, `{ raw, cooked }`. */
function isQuasiValue(value: unknown): value is { raw: string; cooked: string | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { raw?: unknown }).raw === "string"
  );
}

/** The literal and comment tokens of an expression's code, in source order. */
export function codeTokens(code: string): CodeToken[] {
  const { expression, comments } = parseExpressionSource(code);
  const tokens: CodeToken[] = comments.map(({ start, end }) => ({ kind: "comment", start, end }));
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isNode(value)) return;
    if (value.type === "Literal") {
      if (value.regex) tokens.push({ kind: "regex", ...at(value) });
      else if (typeof value.value === "string") {
        tokens.push({ kind: "string", ...at(value), value: value.value });
      } else if (typeof value.value === "number") {
        tokens.push({ kind: "number", ...at(value), value: value.value });
      }
      return;
    }
    if (value.type === "TemplateElement" && isQuasiValue(value.value)) {
      // oxc's span covers the delimiters around the quasi: one character before it (`` ` `` or
      // the `}` that ends a substitution), and `` ` `` or `${` after it.
      const { raw, cooked } = value.value;
      const start = value.start + 1;
      tokens.push({ kind: "template", start, end: start + raw.length, cooked: cooked ?? raw });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "type" && typeof child === "object") visit(child);
    }
  };
  visit(expression);
  return tokens.toSorted((a, b) => a.start - b.start);
}

const at = (node: Node) => ({ start: node.start, end: node.end });

/**
 * Rewrites expression code token by token: each literal and comment through its own function in
 * `map`, the code between them through `other`. A function left out keeps its text.
 */
export function mapCode(code: string, map: CodeMap): string {
  let output = "";
  let position = 0;
  const other = (text: string) => (map.other && text ? map.other(text, output) : text);
  for (const token of codeTokens(code)) {
    output += other(code.slice(position, token.start));
    const raw = code.slice(token.start, token.end);
    switch (token.kind) {
      case "string":
        output += map.string ? map.string(raw, token, output) : raw;
        break;
      case "template":
        output += map.template ? map.template(raw, token, output) : raw;
        break;
      case "regex":
        output += map.regex ? map.regex(raw, output) : raw;
        break;
      case "number":
        output += map.number ? map.number(raw, token, output) : raw;
        break;
      case "comment":
        output += map.comment ? map.comment(raw, output) : raw;
        break;
      default:
        unreachable(token);
    }
    position = token.end;
  }
  return output + other(code.slice(position));
}

/**
 * A string literal with `quote` around `value`, written with only the escapes every template
 * expression language reads (`\n \r \t \v \f \\ \' \" \uXXXX`: Angular's lexer reads no
 * others), and `\uXXXX` for control characters, line separators and lone surrogates. `escape`
 * spells any other character its own way (a template's delimiters), or returns `undefined`.
 */
export function quoteString(
  value: string,
  quote: "'" | '"',
  escape: (character: string) => string | undefined = () => undefined,
): string {
  return `${quote}${escapeCharacters(value, (character) =>
    character === quote ? `\\${quote}` : escape(character),
  )}${quote}`;
}

/**
 * The text of a template literal's quasi whose value is `cooked`, written as
 * {@link quoteString} writes strings, with `` ` `` and the `$` of a `${` escaped.
 */
export function quasiText(
  cooked: string,
  escape: (character: string) => string | undefined = () => undefined,
): string {
  return escapeCharacters(cooked, (character) =>
    character === "`" ? "\\`" : escape(character),
  ).replace(/\$(?=\{)/g, "\\$");
}

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\v": "\\v",
  "\f": "\\f",
};

function escapeCharacters(value: string, escape: (character: string) => string | undefined) {
  let output = "";
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    // A surrogate pair is one character, written as it is; a lone surrogate is escaped.
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += value.slice(index, index + 2);
        index++;
        continue;
      }
    }
    const character = value[index]!;
    output +=
      escape(character) ??
      SIMPLE_ESCAPES[character] ??
      (unit < 0x20 ||
      unit === 0x7f ||
      unit === 0x2028 ||
      unit === 0x2029 ||
      (unit >= 0xd800 && unit <= 0xdfff)
        ? unicodeEscape(character)
        : character);
  }
  return output;
}

/** `}` as an escape, for a literal a template scanner must not end an interpolation in. */
const escapeClosingBrace = (character: string) => (character === "}" ? "\\u007d" : undefined);

/**
 * Code with no `}}` in it, for an interpolation that a template scanner ends at the first one
 * whatever surrounds it (Vue; Angular outside quotes). A pair in punctuation or a comment gets a
 * space; a string or a template literal's quasi that holds one is re-printed from its value with
 * its braces escaped; a pair in a regular expression gets an escaped second brace (`\}` means
 * `}` there either way). The one pair that spans two tokens, a substitution's closing `}` before
 * a quasi that starts with `}`, is a quasi to re-print too.
 */
export function separateClosingBraces(code: string): string {
  if (!code.includes("}}")) return code;
  return mapCode(code, {
    string: (raw, { value }) =>
      raw.includes("}}")
        ? quoteString(value, raw.startsWith("'") ? "'" : '"', escapeClosingBrace)
        : raw,
    template: (raw, { cooked }, before) =>
      raw.includes("}}") || (before.endsWith("}") && raw.startsWith("}"))
        ? quasiText(cooked, escapeClosingBrace)
        : raw,
    regex: (raw) => raw.replace(/(?<=\})\}/g, "\\}"),
    comment: (raw) => raw.replace(/\}(?=\})/g, "} "),
    other: (text) => text.replace(/\}(?=\})/g, "} "),
  });
}

function unreachable(value: never): never {
  throw new Error(`Unexpected token: ${JSON.stringify(value)}`);
}
