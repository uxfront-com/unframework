// Angular templates (design §5.5): `{{ }}` interpolations, `[attr.x]` bindings, `@if` and `@for`
// blocks, a static `class` beside one `[class]` binding, a static `style` beside `[style.x]`
// bindings. Angular's expression language is not JavaScript: its lexer reads fewer escapes and
// no comments, so literals are re-printed from their values and comments dropped, token by token.
import { angularLowercases, angularMisreads, BINDABLE_BOOLEAN_ATTRIBUTES } from "@unframework/ir";

import { parseExpression, parseExpressionSource } from "../rewrite.ts";
import {
  escapeBraces,
  escapeHtmlAttribute,
  escapeHtmlText,
  escapeReferences,
  mapCode,
  quoteString,
  stringLiteral,
  unicodeEscape,
} from "./escape.ts";
import {
  isRoot,
  keepsWhitespace,
  operand,
  staticClassValue,
  staticStyleValue,
  test,
  toggleObject,
  withoutEmptyBranches,
} from "./printer.ts";
import type {
  ClassPart,
  LiteralRegion,
  MarkupDialect,
  StylePart,
  TextPosition,
} from "./printer.ts";

/**
 * Angular's `WS_CHARS`: with `preserveWhitespaces: false` it drops text made only of these and
 * turns any run of two or more into one space, interpolations included, before rendering.
 */
const ANGULAR_SPACE =
  " \\f\\n\\r\\t\\v\\u1680\\u180e\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
const ANGULAR_WHITESPACE_ONLY = new RegExp(`^[${ANGULAR_SPACE}]+$`);
const ANGULAR_RUN = new RegExp(`[${ANGULAR_SPACE}]{2,}`);
/**
 * U+E500, which Angular writes for `&ngsp;`: its parser turns the character into a space in all
 * text, interpolated literals and `<pre>` included, after it has decoded references to it.
 */
const NGSP = "\ue500";
/** Angular's whitespace but the plain space, and U+E500: a literal writes them as escapes. */
const ANGULAR_OTHER_SPACE = new RegExp(`^[${ANGULAR_SPACE.replace(" ", "")}${NGSP}]$`);
/**
 * JavaScript's whitespace outside ASCII, which may separate an expression's tokens: Angular's
 * expression lexer reads only ASCII whitespace and the no-break space, and rejects the rest.
 */
const NON_ASCII_SPACE = /[\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g;

/** A decimal number literal as Angular's lexer reads it: digits, `_`, one `.`, an exponent. */
const DECIMAL = /^(?=\.?\d)(?:\d(?:_?\d)*)?(?:\.(?:\d(?:_?\d)*)?)?(?:[eE][+-]?\d(?:_?\d)*)?$/;

/**
 * Where Angular reads an expression: an interpolation (`{{ }}` in text, where entities are
 * decoded, a template scanner looks for `}}` and `<` may open a tag), an attribute value
 * (`[attr.x]="…"`, decoded), or a block's parameters (`@if (…)`, read as written).
 */
export type AngularContext = "interpolation" | "attribute" | "block";

/**
 * A character of a re-printed literal that Angular, or the template around the expression,
 * would read differently: its whitespace processing (any space but a plain one, and U+E500),
 * entities and markup (`&`, `<`, `>`) and its block and ICU syntax (`{`, `}`).
 */
function angularCharacter(character: string): string | undefined {
  // `\n`, `\t` and the other simple escapes keep their short spelling.
  if (/[\n\r\t\v\f]/.test(character)) return undefined;
  return /[&<>{}]/.test(character) || ANGULAR_OTHER_SPACE.test(character)
    ? unicodeEscape(character)
    : undefined;
}

/** A run of spaces, which Angular's whitespace processing would condense, as escapes. */
const escapeSpaceRuns = (text: string) => text.replace(/ {2,}/g, unicodeEscape);

/** `<` where Angular's template lexer opens a tag: before a letter, `/`, `!` or `?`. */
const TAG_START = /<(?=[A-Za-z!/?])/g;

/**
 * Expression code as Angular reads it where `context` says, re-spelled token by token (design
 * §4.3): string literals from their values, with only the escapes Angular's lexer reads (it
 * reads `"\x41"` as `"x41"`) and none of its delimiters; template literals as concatenations of
 * such strings ({@link withoutTemplateLiterals}); number literals in decimal, kept apart from a
 * `.` or `?` beside them ({@link angularNumber}); regular
 * expressions with escapes for what its template reads in them ({@link angularRegex}); comments,
 * which it cannot hold, as a space; whitespace outside ASCII between tokens, which its lexer
 * rejects, as a space. In an interpolation, a `}}` outside quotes would end it and `<` before a
 * letter would open a tag; in an interpolation or an attribute value, character references are
 * decoded first and, in an attribute, `"` ends the value. In every context, Angular ends the
 * expression at a `//` it finds outside quotes, which it tracks without escapes, so a closing
 * `/` before a division gets a space, and no string holds a backslash before a quote
 * ({@link angularString}).
 */
export function angularCode(code: string, context: AngularContext): string {
  const interpolation = context === "interpolation";
  const source = withoutTemplateLiterals(code);
  const respelled = mapCode(source, {
    string: (_, { value }) => angularString(value, context === "attribute" ? "'" : '"'),
    number: (raw, { value, end }, before) => angularNumber(raw, value, before, source[end]),
    regex: (raw, before) => {
      const regex = angularRegex(raw, interpolation);
      if (!interpolation) return regex;
      // `a</b/` would open a tag; `\}` means `}` in a regular expression either way.
      return `${before.endsWith("<") ? " " : ""}${regex.replace(/(?<=\})\}/g, "\\}")}`;
    },
    comment: () => " ",
    other: (text, before) => {
      const spaced = `${before.endsWith("/") && text.startsWith("/") ? " " : ""}${text.replace(
        NON_ASCII_SPACE,
        " ",
      )}`;
      return interpolation ? spaced.replace(/\}(?=\})/g, "} ").replace(TAG_START, "< ") : spaced;
    },
  }).trim();
  if (context === "block") return respelled;
  // An attribute value's lexer decodes each reference on its own.
  if (context === "attribute") return escapeReferences(respelled).replace(/"/g, "&quot;");
  // Angular decodes an interpolation's references only once it has found its end, with
  // `/&([^;]+);/`: a bare `&` (`a && b`) would take the `;` of a reference after it, which then
  // reaches the expression as written. So where a reference is needed, every `&` is one: an `&`
  // that could start one (`/R&D/`), and a `<` left before a letter, which is a regular
  // expression's (`(?<name>…)`), where a space would change it, and which would open a tag.
  return /&[A-Za-z0-9#]/.test(respelled) || respelled.search(TAG_START) !== -1
    ? respelled.replace(/&/g, "&amp;").replace(TAG_START, "&lt;")
    : respelled;
}

/**
 * A number literal as Angular's lexer reads it: in decimal, as written where it can be. Its
 * lexer takes every `.` after a number into it (`1.5.toFixed(1)`, `5..toString()`), so a number
 * a member access follows is parenthesised, as oxfmt writes one for React; and it reads `?.` as
 * optional chaining, so a leading-dot number after a `?` (`c?.5:1`) gets its `0`.
 */
function angularNumber(raw: string, value: number, before: string, next?: string): string {
  const decimal = DECIMAL.test(raw) ? raw : String(value);
  if (next === ".") return `(${decimal.replace(/\.$/, "")})`;
  return before.endsWith("?") && decimal.startsWith(".") ? `0${decimal}` : decimal;
}

/**
 * A string literal from its value, with only the escapes Angular's lexer reads, none of its
 * delimiters and no run of spaces, and no backslash before a quote: the target writes the
 * template in a TypeScript template literal, whose raw text angular-eslint lints (L5), where
 * `\'` reads as an escaped backslash and a quote that ends the string; and Angular's search for
 * a comment (`//`) ends a string at any quote of its kind. So it takes `preferred`, or the other
 * quote when only `preferred` is in the value (in an attribute, `"` is then written `&quot;`),
 * and writes its own quote as a `\u` escape when the value holds both.
 */
function angularString(value: string, preferred: "'" | '"'): string {
  const other = preferred === "'" ? '"' : "'";
  const quote = value.includes(preferred) && !value.includes(other) ? other : preferred;
  return escapeSpaceRuns(quoteString(value, quote, angularCharacter)).replace(
    /\\[\s\S]/g,
    (escape) => (escape === `\\${quote}` ? unicodeEscape(quote) : escape),
  );
}

/** A character of a regular expression as an escape that means it with any flags. */
function regexEscape(character: string): string {
  const unit = character.charCodeAt(0);
  return unit < 0x100 ? `\\x${unit.toString(16).padStart(2, "0")}` : unicodeEscape(character);
}

/**
 * What a regular expression only ever holds as a literal and Angular's template reads: quotes,
 * `;`, and its whitespace but the plain space (runs of which are escaped too), and U+E500.
 */
const REGEX_ESCAPED = new RegExp(`['"\`;${ANGULAR_SPACE.replace(" ", "")}${NGSP}]`);

/**
 * A regular expression literal as Angular's template reads it, with escapes (`\x27`) for what
 * would otherwise end or change it: the lexers that find an interpolation's `}}`, a block
 * parameter's `;` and `)` and a comment's `//` track quotes, so a quote in `/'/` opens one; the
 * block lexer counts the parentheses in a class (`/[)]/`); a body that writes `//` (`/^\//`)
 * holds a comment; and whitespace processing condenses a run of spaces and turns U+E500 into a
 * space. So each quote, `;`, whitespace character but a lone space, and parenthesis in a class
 * is an escape, and so is every `/` of a body that would write `//`. A parenthesis outside a
 * class is a group, which is balanced. An escaped `/`, bracket or parenthesis is an escape of
 * this kind too (`\x2f`): angular-eslint lints the raw text of the TypeScript template literal
 * the template sits in, where its backslash is doubled, and the character after it would be
 * syntax there. In an interpolation, a literal `<` before a letter would open a tag, and is an
 * escape too; one that opens a group's name or a lookbehind (`(?<x>`, `(?<!`, `\k<x>`) is left
 * to `angularCode`.
 */
function angularRegex(raw: string, interpolation: boolean): string {
  const close = raw.lastIndexOf("/");
  const units: { text: string; slash: boolean }[] = [];
  let inClass = false;
  for (let index = 1; index < close; index++) {
    const character = raw[index]!;
    if (character === "\\") {
      const escaped = raw[++index]!;
      // angular-eslint lints the template's raw text, where the backslash is doubled and so
      // escapes itself: a `/`, a bracket or a parenthesis after it would be syntax there.
      units.push(
        REGEX_ESCAPED.test(escaped) || /[ /[\]()]/.test(escaped)
          ? { text: regexEscape(escaped), slash: false }
          : { text: `\\${escaped}`, slash: escaped === "/" },
      );
      continue;
    }
    if (character === "[") inClass = true;
    else if (character === "]") inClass = false;
    const syntax =
      !inClass &&
      (units.at(-1)?.text === "\\k" ||
        units
          .slice(-2)
          .map((unit) => unit.text)
          .join("") === "(?");
    const escape =
      REGEX_ESCAPED.test(character) ||
      (inClass && /[()]/.test(character)) ||
      (interpolation && character === "<" && !syntax && /[A-Za-z!/?]/.test(raw[index + 1] ?? ""));
    units.push({ text: escape ? regexEscape(character) : character, slash: character === "/" });
  }
  // A `{` before another is a literal (a quantifier's starts a number): as an escape, it keeps
  // the `{{` out of an attribute value, whose lexer would decode what follows it as an
  // interpolation's text ({@link angularCode}).
  units.forEach((unit, at) => {
    if (unit.text.endsWith("{") && units[at + 1]?.text.startsWith("{")) unit.text = "\\x7b";
  });
  const write = (slashes: boolean) =>
    units
      .map((unit) => (slashes && unit.slash ? "\\x2f" : unit.text))
      .join("")
      .replace(/ {2,}/g, (run) => "\\x20".repeat(run.length));
  const body = `/${write(false)}/`.includes("//") ? write(true) : write(false);
  return `/${body}/${raw.slice(close + 1)}`;
}

interface TemplateNode {
  type: string;
  start: number;
  end: number;
  quasis?: { value: { cooked: string | null; raw: string } }[];
  expressions?: { start: number; end: number }[];
  [key: string]: unknown;
}

function isTemplateNode(value: unknown): value is TemplateNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** Operators that bind tighter than `+`, whose expressions can be added as written. */
const TIGHTER_THAN_ADDITION: ReadonlySet<string> = new Set(["*", "/", "%", "**"]);

/** Code as the right operand of `+`, parenthesised unless it binds tighter (`a - b` does not). */
function addend(code: string): string {
  const expression = parseExpression(code);
  const tighter =
    expression.type === "UnaryExpression" ||
    (expression.type === "Literal" && typeof expression.value === "number") ||
    (expression.type === "BinaryExpression" && TIGHTER_THAN_ADDITION.has(expression.operator));
  return tighter ? code : operand(code);
}

/**
 * Operators that bind looser than `+`, whose operands a concatenation can be as written: a
 * comparison is a string comparison either way.
 */
const LOOSER_THAN_ADDITION: ReadonlySet<string> = new Set([
  "==",
  "!=",
  "===",
  "!==",
  "<",
  "<=",
  ">",
  ">=",
]);

/**
 * Whether a concatenation can replace a template literal as written where `parent` holds it
 * under `key`: anywhere that takes an expression looser than `+` (an element, an argument, a
 * property's value, a conditional's or a logical expression's operand, a comparison's operand,
 * an arrow's body), or as the left operand of `+` or `-`, which group from the left. Elsewhere
 * (`.length`, `!`, `*`, the right of `+`) it is parenthesised.
 */
function concatenationFits(parent: TemplateNode, key: string): boolean {
  switch (parent.type) {
    case "ArrayExpression":
    case "SpreadElement":
    case "ConditionalExpression":
    case "LogicalExpression":
      return true;
    case "CallExpression":
      return key === "arguments";
    case "Property":
      return key === "value";
    case "ArrowFunctionExpression":
      return key === "body";
    case "BinaryExpression": {
      const operator = parent.operator as string;
      return LOOSER_THAN_ADDITION.has(operator) || (key === "left" && /^[+-]$/.test(operator));
    }
    default:
      return false;
  }
}

/**
 * Code whose template literals are string concatenations (`` `a-${b}` `` → `"a-" + b`), with
 * the same value for every value M1 interpolates: a template is written in the target's
 * TypeScript template literal, where each backtick must be escaped, and angular-eslint parses an
 * inline template's raw text, so it cannot read one (L5, ADR-0042). A concatenation whose first
 * two parts are both expressions starts with `""` (`` `${a}${b}` `` → `"" + a + b`), so `+`
 * never adds numbers; one with a string among its first two parts is a string from its first
 * `+` (`` `${n}px` `` → `n + "px"`). It is parenthesised only where `+` would bind wrongly.
 */
export function withoutTemplateLiterals(code: string): string {
  if (!code.includes("`")) return code;
  const { expression } = parseExpressionSource(code);
  const outermost: { template: TemplateNode; fits: boolean }[] = [];
  const visit = (value: unknown, parent: TemplateNode | undefined, key: string): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, parent, key);
      return;
    }
    if (!isTemplateNode(value)) return;
    if (value.type === "TemplateLiteral") {
      outermost.push({
        template: value,
        fits: parent === undefined || concatenationFits(parent, key),
      });
      return;
    }
    for (const [childKey, child] of Object.entries(value)) {
      if (childKey !== "type" && typeof child === "object") visit(child, value, childKey);
    }
  };
  visit(expression, undefined, "");
  let output = "";
  let position = 0;
  for (const { template, fits } of outermost) {
    output += code.slice(position, template.start);
    const parts: { code: string; string: boolean }[] = [];
    template.quasis!.forEach((quasi, index) => {
      const cooked = quasi.value.cooked ?? quasi.value.raw;
      if (cooked !== "") parts.push({ code: JSON.stringify(cooked), string: true });
      const substitution = template.expressions![index];
      if (substitution) {
        const inner = withoutTemplateLiterals(code.slice(substitution.start, substitution.end));
        parts.push({ code: addend(inner), string: false });
      }
    });
    if (!parts.slice(0, 2).some((part) => part.string)) {
      parts.unshift({ code: '""', string: true });
    }
    // A lone string is a literal, which needs no parentheses anywhere.
    const joined = parts.map((part) => part.code).join(" + ");
    output += fits || parts.length === 1 ? joined : `(${joined})`;
    position = template.end;
  }
  return output + code.slice(position);
}

/**
 * Angular templates: `{{` interpolates even when written as entities (Angular decodes them
 * first), in text and in attribute values; `{ }` are reserved; `@` opens a block; and
 * `preserveWhitespaces: false` drops text made only of Angular's whitespace and condenses runs
 * of it, inside interpolations too, where text and the interpolations beside it are one text
 * node. A lone space becomes `&ngsp;` (one space Angular keeps); text it would rewrite becomes an
 * interpolated string literal with every such space escaped. A `{` right before an
 * interpolation would open it early once decoded, so it is one too. `preserveWhitespaces:
 * false` is Angular's default, which the Angular target pins in every component's metadata.
 * Text or an interpolation at an edge of the root goes in an `<ng-container>`: the target puts
 * the markup on lines of its own, and the line break would otherwise join its text node.
 *
 * Every bound attribute is `[attr.name]` (a property binding renders `null` as `"null"`), and a
 * bound boolean attribute `[attr.name]="c ? '' : null"` (ADR-0037). A class is a static `class`
 * beside one `[class]`: an object of toggles, or one string expression when a dynamic part is
 * present (`[class.name]` loses names with a dot, and a `[class]` array drops entries that hold
 * a space; ADR-0038). Conditionals are `@if` chains, with an empty branch folded into the
 * conditions after it (`@if (c) {}` fails angular-eslint); lists are `@for` with `track`.
 *
 * An attribute value holding `{{` has no static spelling, and a binding to it would go through
 * Angular's security checks: a URL its sanitizer rejects gets an `unsafe:` prefix, a resource
 * URL (`iframe src`, `object data`) fails with NG0904, and a bound `sandbox` or `allow` removes
 * the `iframe`. So such an element is printed in
 * `<ng-container ngNonBindable ngPreserveWhitespaces>`: the container renders no element (only
 * Angular's comment anchor), `ngNonBindable` makes its descendants' attributes and text static
 * (not its own, hence the container), and `ngPreserveWhitespaces` keeps their whitespace as
 * written, since interpolated literals no longer protect it there. Nothing in it binds, so it
 * holds only static content (ADR-0037).
 *
 * Angular's parser puts `<svg>` and everything inside it in the SVG namespace (`:svg:`), which
 * every IR tree has around its SVG elements: a component rooted in an SVG child, which would need
 * `:svg:` prefixes, is UF1002 until M3 (ADR-0040). Its lexer reads a `<title>`'s content as text,
 * blocks included, unless the tag itself names the namespace, so an SVG title is `<svg:title>`.
 */
export const angularDialect: MarkupDialect = {
  name: "angular",
  escapeText: (text, position) => rootEdge(position, angularText(text, position)),
  attribute: (name, value) => {
    if (value.includes("{{")) {
      throw new Error(`An Angular attribute holding "{{" is printed in its literal region.`);
    }
    return `${name}="${escapeBraces(escapeHtmlAttribute(value))}"`;
  },
  voidElement: "self-closing",
  // A parent `<svg>` does not count: only the tag's own prefix makes the lexer read blocks there.
  elementName: (tag, namespace) => (namespace === "svg" && tag === "title" ? "svg:title" : tag),
  stripsWhitespaceBetweenElements: true,
  stripsEdgeWhitespace: true,
  literalRegion: (element) =>
    element.attributes.some(
      (attribute) =>
        attribute.kind === "Static" && attribute.value !== true && attribute.value.includes("{{"),
    )
      ? ANGULAR_LITERAL_REGION
      : undefined,
  interpolation: (code, position) =>
    rootEdge(position, `{{ ${angularCode(code, "interpolation")} }}`),
  boundAttribute: (name, code, { namespace }) =>
    namespace === "html" && BINDABLE_BOOLEAN_ATTRIBUTES.has(name)
      ? `[attr.${name}]="${angularCode(`${test(code)} ? "" : null`, "attribute")}"`
      : `[attr.${name}]="${angularCode(code, "attribute")}"`,
  classAttribute: (written) => {
    // A static name holding `{{` has no static spelling (it would interpolate): it is bound as a
    // string, which a class binding takes as written (no security context).
    const parts = written.map((part): ClassPart =>
      part.kind === "Static" && part.value.includes("{{")
        ? { kind: "Dynamic", value: JSON.stringify(part.value) }
        : part,
    );
    const value = staticClassValue(parts);
    const printed = value
      ? [{ name: "class", text: angularDialect.attribute("class", value, "") }]
      : [];
    const bound = parts.filter((part) => part.kind !== "Static");
    if (bound.length === 0) return printed;
    const [only, ...more] = bound;
    const expression = bound.every((part) => part.kind === "Toggle")
      ? toggleObject(bound)
      : only?.kind === "Dynamic" && more.length === 0
        ? only.value
        : // `join` writes `null` and `undefined` as nothing, which `+` would not.
          `[${bound
            .map((part) =>
              part.kind === "Toggle"
                ? `${test(part.condition)} ? ${JSON.stringify(part.name)} : null`
                : part.kind === "Dynamic"
                  ? part.value
                  : "",
            )
            .join(", ")}].join(" ")`;
    return [
      ...printed,
      { name: "class", text: `[class]="${angularCode(expression, "attribute")}"` },
    ];
  },
  styleAttribute: (written) => {
    readsEveryDeclaration(written);
    // A static value holding `{{` is bound as a string, as a class name is: Angular does not
    // sanitise style bindings.
    const parts = written.map((part): StylePart =>
      part.kind === "Static" && part.value.includes("{{")
        ? { kind: "Bound", property: part.property, value: JSON.stringify(part.value) }
        : part,
    );
    const value = staticStyleValue(parts);
    const printed = value
      ? [{ name: "style", text: angularDialect.attribute("style", value, "") }]
      : [];
    for (const part of parts) {
      if (part.kind === "Bound") {
        printed.push({
          name: "style",
          text: `[style.${part.property}]="${angularCode(part.value, "attribute")}"`,
        });
      }
    }
    return printed;
  },
  conditional: (branches) => [
    {
      kind: "block",
      segments: withoutEmptyBranches(branches).map(({ condition, branch }, index) => ({
        open:
          index === 0
            ? `@if (${angularCode(condition!, "block")}) {`
            : condition === undefined
              ? "} @else {"
              : `} @else if (${angularCode(condition, "block")}) {`,
        content: { kind: "nodes", nodes: branch.children, container: branch },
      })),
      close: "}",
    },
  ],
  list: ({ node, source, item, index, key }) => [
    {
      kind: "block",
      segments: [
        {
          open: `@for (${item} of ${angularCode(source, "block")}; track ${angularCode(key, "block")}${
            index === undefined ? "" : `; let ${index} = $index`
          }) {`,
          content: { kind: "nodes", nodes: [node.body], container: node },
        },
      ],
      close: "}",
    },
  ],
};

/**
 * Text as M0 writes it for Angular: references, `&ngsp;`, and literals for what it rewrites.
 * Right after an `@if` or `@for` block, Angular's parser drops a text node that JavaScript's
 * `trim()` empties while it looks for the block's `@else` or `@empty` (`findConnectedBlocks`):
 * `&ngsp;`, a non-breaking space, even inside `<pre>`. There the text is an interpolated literal,
 * which is no blank text, with each space but a lone plain one escaped so it reads.
 */
function angularText(text: string, position: TextPosition): string {
  const afterBlock = position.previous === "If" || position.previous === "For";
  if (afterBlock && text.trim() === "") {
    return angularInterpolation(text).replace(/[^\x20-\x7e]/g, unicodeEscape);
  }
  // Only an escape in a literal keeps U+E500 from becoming a space, in a `<pre>` too.
  if (text.includes(NGSP)) return angularInterpolation(text);
  if (keepsWhitespace(position)) return escapeAngular(text, position);
  if (text === " ") return "&ngsp;";
  return ANGULAR_WHITESPACE_ONLY.test(text) || ANGULAR_RUN.test(text)
    ? angularInterpolation(text)
    : escapeAngular(text, position);
}

/**
 * Text or an interpolation at an edge of the root, in an `<ng-container>`: there the target's
 * own line break would join its text node, and Angular would keep it as a space.
 */
function rootEdge(position: TextPosition, written: string): string {
  return isRoot(position.container) && (position.first || position.last)
    ? `<ng-container>${written}</ng-container>`
    : written;
}

/**
 * Angular markup inside `ngNonBindable` with its whitespace preserved: Angular reads no binding
 * and changes no whitespace there, but its lexer still decodes entities and reads `{` (an ICU
 * expression) and `@` (a block), which are written as references. Nothing binds there, so only
 * static content can be printed in it.
 */
const angularLiteralDialect: MarkupDialect = {
  name: "angular-literal",
  escapeText: (text) => escapeBraces(escapeHtmlText(text)).replace(/@/g, "&#64;"),
  attribute: (name, value) => `${name}="${escapeBraces(escapeHtmlAttribute(value))}"`,
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: false,
  interpolation: () => staticOnly("an interpolation"),
  boundAttribute: (name) => staticOnly(`a bound \`${name}\``),
  classAttribute: (parts) =>
    parts.every((part) => part.kind === "Static")
      ? [
          {
            name: "class",
            text: angularLiteralDialect.attribute("class", staticClassValue(parts), ""),
          },
        ]
      : staticOnly("a class binding"),
  styleAttribute: (parts) => {
    if (parts.some((part) => part.kind !== "Static")) return staticOnly("a style binding");
    readsEveryDeclaration(parts);
    return [
      {
        name: "style",
        text: angularLiteralDialect.attribute("style", staticStyleValue(parts), ""),
      },
    ];
  },
  conditional: () => staticOnly("a conditional"),
  list: () => staticOnly("a list"),
};

/**
 * Whether Angular reads a declaration back as written. Its compiler parses a static `style`
 * again (`parse` in its style parser), and its server DOM parses every style it sets the same
 * way: it splits at a `;` outside quotes and parentheses, but counts the parentheses inside
 * quotes, ends a quote at an escaped one (`"a\";b"`), knows no comments, and lowercases each
 * property (`--myColor` becomes `--my-color`). Read from where a declaration starts, the value
 * must hold no `;` that would end it, and end outside quotes and parentheses, so that the next
 * declaration starts as written too. The analyser rejects any other (UF3022, ADR-0038).
 */
function angularReadsStatic(property: string, value: string): boolean {
  return !angularLowercases(property) && !angularMisreads(value);
}

/** Throws for a declaration Angular would misread, which the analyser keeps out of the IR. */
function readsEveryDeclaration(parts: readonly StylePart[]): void {
  const misread = parts.find((part) =>
    part.kind === "Static"
      ? !angularReadsStatic(part.property, part.value)
      : angularLowercases(part.property),
  );
  if (misread) {
    throw new Error(
      `Angular's style parser misreads \`${misread.property}: ${misread.value}\` (UF3022, ADR-0038).`,
    );
  }
}

/** ADR-0037: the analyser keeps anything that binds out of an element that needs the region. */
function staticOnly(what: string): never {
  throw new Error(
    `Angular's ngNonBindable region binds nothing, so it cannot hold ${what} (ADR-0037).`,
  );
}

const ANGULAR_LITERAL_REGION: LiteralRegion = {
  open: "<ng-container ngNonBindable ngPreserveWhitespaces>",
  close: "</ng-container>",
  dialect: angularLiteralDialect,
};

/**
 * An Angular interpolation of the text as a literal ({@link angularString}), with nothing
 * Angular's whitespace processing changes: any space but a lone plain one, and U+E500, is an
 * escape.
 */
function angularInterpolation(text: string): string {
  return `{{ ${angularString(text, '"')} }}`;
}

/**
 * Angular decodes entities before it looks for `{{`, so a run of `{` is an interpolated
 * literal, and so is a `{` right before an interpolation.
 */
function escapeAngular(text: string, position: TextPosition): string {
  const braces =
    position.next === "Interpolation" ? /(?:&#123;)+$|(?:&#123;){2,}/g : /(?:&#123;){2,}/g;
  return escapeBraces(escapeHtmlText(text))
    .replace(braces, (run) => `{{ ${stringLiteral("{".repeat(run.length / "&#123;".length))} }}`)
    .replace(/@/g, "&#64;");
}
