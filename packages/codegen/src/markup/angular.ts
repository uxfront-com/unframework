// Angular templates (design §5.5): `{{ }}` interpolations, `[attr.x]` bindings, `@if` and `@for`
// blocks, a static `class` beside one `[class]` binding, a static `style` beside `[style.x]`
// bindings. Angular's expression language is not JavaScript: its lexer reads fewer escapes and
// no comments, so literals are re-printed from their values and comments dropped, token by token.
import { BINDABLE_BOOLEAN_ATTRIBUTES } from "@unframework/ir";

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
/** What Angular's processing could see in a string literal: runs, and any space but `" "`. */
const ANGULAR_LITERAL_SPACE = new RegExp(
  `[${ANGULAR_SPACE}]{2,}|[${ANGULAR_SPACE.replace(" ", "")}]`,
  "g",
);
/** Angular's whitespace but the plain space, which a literal writes as an escape. */
const ANGULAR_OTHER_SPACE = new RegExp(`^[${ANGULAR_SPACE.replace(" ", "")}]$`);

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
 * would read differently: its whitespace processing (any space but a plain one), entities and
 * markup (`&`, `<`, `>`) and its block and ICU syntax (`{`, `}`).
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

/**
 * Expression code as Angular reads it where `context` says, re-spelled token by token (design
 * §4.3): string literals from their values, with only the escapes Angular's lexer reads (it
 * reads `"\x41"` as `"x41"`) and none of its delimiters; template literals as concatenations of
 * such strings ({@link withoutTemplateLiterals}); number literals in decimal;
 * comments, which it cannot hold, as a space. In an interpolation, a `}}` outside quotes would
 * end it and `<` before a letter would open a tag; in an interpolation or an attribute value,
 * character references are decoded first and, in an attribute, `"` ends the value.
 */
export function angularCode(code: string, context: AngularContext): string {
  const interpolation = context === "interpolation";
  const respelled = mapCode(withoutTemplateLiterals(code), {
    string: (_, { value }) =>
      escapeSpaceRuns(quoteString(value, context === "attribute" ? "'" : '"', angularCharacter)),
    number: (raw, { value }) => (DECIMAL.test(raw) ? raw : String(value)),
    regex: (raw) =>
      interpolation ? raw.replace(/(?<=\})\}/g, "\\}").replace(/<(?=[A-Za-z!/?])/g, "\\x3c") : raw,
    comment: () => " ",
    other: (text) =>
      interpolation ? text.replace(/\}(?=\})/g, "} ").replace(/<(?=[A-Za-z!/?])/g, "< ") : text,
  }).trim();
  if (context === "block") return respelled;
  const decoded = escapeReferences(respelled);
  return context === "attribute" ? decoded.replace(/"/g, "&quot;") : decoded;
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
 * `:svg:` prefixes, is UF1002 until M3 (ADR-0040).
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

/** Text as M0 writes it for Angular: references, `&ngsp;`, and literals for what it rewrites. */
function angularText(text: string, position: TextPosition): string {
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
  styleAttribute: (parts) =>
    parts.every((part) => part.kind === "Static")
      ? [
          {
            name: "style",
            text: angularLiteralDialect.attribute("style", staticStyleValue(parts), ""),
          },
        ]
      : staticOnly("a style binding"),
  conditional: () => staticOnly("a conditional"),
  list: () => staticOnly("a list"),
};

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

/** An Angular interpolation of the text, with nothing Angular's whitespace processing changes. */
function angularInterpolation(text: string): string {
  return `{{ ${stringLiteral(text).replace(ANGULAR_LITERAL_SPACE, unicodeEscape)} }}`;
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
