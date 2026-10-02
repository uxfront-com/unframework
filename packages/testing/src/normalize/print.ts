import { attributeName, childrenOf, HTML_NAMESPACE, isElement, isText } from "./tree.ts";
import type { TreeElement, TreeParent } from "./tree.ts";

/**
 * Elements that never have children or an end tag, including the obsolete ones the HTML parser
 * still treats as void.
 */
const VOID_ELEMENTS: ReadonlySet<string> = new Set(
  "area base basefont bgsound br col embed frame hr img input keygen link meta param source track wbr".split(
    " ",
  ),
);

const NAMED_ESCAPES: Readonly<Record<string, string>> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

/**
 * Characters a reader could not see or tell apart: quotes and backslashes, every control,
 * format, private-use, unassigned and surrogate code point, every space other than U+0020
 * (U+00A0 and the other Unicode spaces, and the line and paragraph separators), and the
 * variation selectors, which change a glyph without a visible character of their own.
 */
const NEEDS_ESCAPE =
  /["\\\p{C}\p{Zl}\p{Zp}\p{Variation_Selector}\u{a0}\u{1680}\u{2000}-\u{200a}\u{202f}\u{205f}\u{3000}]/gu;

/** {@link NEEDS_ESCAPE} and every combining mark, for text that is not in NFC. */
const NEEDS_ESCAPE_DECOMPOSED =
  /["\\\p{C}\p{Zl}\p{Zp}\p{Variation_Selector}\p{M}\u{a0}\u{1680}\u{2000}-\u{200a}\u{202f}\u{205f}\u{3000}]/gu;

/**
 * Writes a string as a JSON string literal in which every invisible or ambiguous character is
 * escaped, so `JSON.parse` reads it back exactly. Code points above U+FFFF that need escaping
 * are written as their two UTF-16 escapes, as JSON requires.
 *
 * Text that is not in Unicode Normalization Form C has its combining marks escaped as well, so
 * a decomposed `é` (`e` and U+0301) never prints like the composed one; text in NFC keeps its
 * marks as they are, so scripts that need them stay readable.
 */
export function quote(text: string): string {
  const escaped = text.replace(
    text.normalize("NFC") === text ? NEEDS_ESCAPE : NEEDS_ESCAPE_DECOMPOSED,
    (char) =>
      NAMED_ESCAPES[char] ??
      Array.from(
        { length: char.length },
        (_, index) => `\\u${char.charCodeAt(index).toString(16).padStart(4, "0")}`,
      ).join(""),
  );
  return `"${escaped}"`;
}

/**
 * Prints a tree in the canonical text format of the reviewed expectation files (`ssr.*.html`,
 * `dom.*.html`). It is deterministic, unambiguous and diff-friendly:
 *
 * - One node per line, indented by two spaces per level.
 * - An element with children is its start tag on one line, its children one level deeper, and
 *   its end tag on its own line. An element without children is `<tag …></tag>` on one line; a
 *   void element is `<tag …>`.
 * - Attributes are written `name="value"` in the tree's order (the normaliser sorts them).
 * - Attribute values and text are JSON string literals with invisible characters escaped (see
 *   `quote`): `"Hello, world!"` is one text node, its spaces visible at both ends; `"a\u00a0b"`
 *   holds a no-break space. Entities are decoded, so `&amp;` is `"&"` and `"<b>"` is text.
 * - A text line holds all the text between two non-text siblings: adjacent text nodes print as
 *   one, because HTML cannot tell them apart. Only the whitespace rule leaves an empty text
 *   node, where Chromium's layout still sees one (beside a ruby), and it prints as `""`.
 * - Comments are not printed (the normaliser drops them anyway).
 * - A `<template>` prints its content as its children.
 * - Every line ends with a line break; an empty tree prints the empty string.
 *
 * ```
 * <p class="greeting">
 *   "Hello, "
 *   <b>
 *     "world"
 *   </b>
 *   "!"
 * </p>
 * <img alt="" src="/a.png">
 * ```
 */
export function printTree(root: TreeParent): string {
  const lines: string[] = [];
  printChildren(root, "", lines);
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

function printChildren(parent: TreeParent, indent: string, lines: string[]): void {
  let text: string | undefined;
  const flush = () => {
    if (text !== undefined) lines.push(indent + quote(text));
    text = undefined;
  };
  for (const node of childrenOf(parent)) {
    if (isText(node)) {
      text = (text ?? "") + node.value;
    } else if (isElement(node)) {
      flush();
      printElement(node, indent, lines);
    }
  }
  flush();
}

function printElement(element: TreeElement, indent: string, lines: string[]): void {
  const attributes = element.attrs
    .map((attribute) => ` ${attributeName(attribute)}=${quote(attribute.value)}`)
    .join("");
  const start = `${indent}<${element.tagName}${attributes}>`;
  if (element.namespaceURI === HTML_NAMESPACE && VOID_ELEMENTS.has(element.tagName)) {
    lines.push(start);
    return;
  }
  const end = `</${element.tagName}>`;
  if (!childrenOf(element).some((node) => isElement(node) || isText(node))) {
    lines.push(start + end);
    return;
  }
  lines.push(start);
  printChildren(element, `${indent}  `, lines);
  lines.push(indent + end);
}
