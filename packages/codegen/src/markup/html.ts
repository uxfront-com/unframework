// Plain HTML: what the IR's static parts look like as a document, for tests and tools. HTML has no
// expressions, so the dialect prints only what is known at compile time.
import { escapeHtmlText, quotedAttribute } from "./escape.ts";
import { staticClassValue, staticStyleValue } from "./printer.ts";
import type { MarkupDialect } from "./printer.ts";

/** Plain HTML has no expressions: a binding or control flow cannot be printed in it. */
function noExpressions(what: string): never {
  throw new Error(`Plain HTML cannot print ${what}: it has no expressions.`);
}

/** Plain HTML: text and attributes are exactly what is written, so lines never break. */
export const htmlDialect: MarkupDialect = {
  name: "html",
  escapeText: escapeHtmlText,
  attribute: quotedAttribute,
  voidElement: "html",
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: false,
  interpolation: () => noExpressions("an interpolation"),
  boundAttribute: (name) => noExpressions(`a bound \`${name}\``),
  classAttribute: (parts) =>
    parts.every((part) => part.kind === "Static")
      ? [{ name: "class", text: quotedAttribute("class", staticClassValue(parts)) }]
      : noExpressions("a class binding"),
  styleAttribute: (parts) =>
    parts.every((part) => part.kind === "Static")
      ? [{ name: "style", text: quotedAttribute("style", staticStyleValue(parts)) }]
      : noExpressions("a style binding"),
  conditional: () => noExpressions("a conditional"),
  list: () => noExpressions("a list"),
};
