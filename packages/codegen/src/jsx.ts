import type * as AST from "@oxc-project/types";
import type { ElementNode, RenderNode } from "@unframework/ir";

import { stringLiteral } from "./js/builders.ts";

const at = { start: 0, end: 0 } as const;

/** How a JSX target writes attributes. */
export interface JsxDialect {
  /**
   * The attribute name the framework expects (React: `class` → `className`), which may depend
   * on the element's other attributes (an input's `type`).
   */
  attributeName?(name: string, element: ElementNode): string;
  /**
   * The value to write for an attribute given without one in the source
   * (`<input disabled />`). `true` writes it bare; a string writes that value.
   */
  presentAttributeValue?(name: string, element: ElementNode): true | string;
}

/** Converts an IR element into a JSX element AST. */
export function jsxElement(node: ElementNode, dialect: JsxDialect = {}): AST.JSXElement {
  const name = { type: "JSXIdentifier", name: node.tag, ...at } as AST.JSXIdentifier;
  const attributes = node.attributes.map((attribute) => {
    const attributeName = dialect.attributeName?.(attribute.name, node) ?? attribute.name;
    const value =
      attribute.value === true
        ? (dialect.presentAttributeValue?.(attribute.name, node) ?? true)
        : attribute.value;
    return {
      type: "JSXAttribute",
      name: { type: "JSXIdentifier", name: attributeName, ...at },
      value: value === true ? null : jsxAttributeValue(value),
      ...at,
    } as AST.JSXAttribute;
  });
  const selfClosing = node.children.length === 0;
  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name,
      attributes,
      selfClosing,
      typeArguments: null,
      ...at,
    },
    closingElement: selfClosing ? null : { type: "JSXClosingElement", name, ...at },
    children: node.children.map((child) => jsxChild(child, dialect)),
    ...at,
  } as unknown as AST.JSXElement;
}

function jsxChild(node: RenderNode, dialect: JsxDialect): AST.JSXChild {
  if (node.kind === "Element") return jsxElement(node, dialect);
  return jsxText(node.value);
}

/**
 * What JSX text may hold as written: no `{ }`, which are syntax, no run of spaces, and no
 * whitespace but the plain space by any JSX implementation's definition. That is JavaScript's
 * `\s`, plus what TypeScript and oxc (`isWhiteSpaceSingleLine`) and the Qwik optimizer's SWC
 * (Unicode's `White_Space`) also trim where a line meets a line break: U+0085 and U+200B.
 */
const UNSAFE_JSX_TEXT = /[{}]|[^\S ]|[\u0085\u200b]| {2}/;

/**
 * JSX text, with `&`, `<` and `>` written as character references, when the text survives
 * every JSX transform and formatter as written: words separated by single plain spaces.
 * Anything else is a string expression (`{"a  b"}`), so the DOM text is exactly the IR's.
 * JSX treats `{ }` as syntax and trims around line breaks; formatters reflow runs of spaces
 * and may move any word to a line's edge; and the transforms disagree on the rest: Solid's
 * collapses raw tabs and Unicode spaces into one space, oxc trims a zero-width space at a
 * line's edge, and the Qwik optimizer decodes a reference (`&#9;`, `&nbsp;`) before it trims a
 * line's edges, so not even those are safe.
 */
export function jsxText(value: string): AST.JSXText | AST.JSXExpressionContainer {
  if (!UNSAFE_JSX_TEXT.test(value) && value.trim() !== "") {
    const raw = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return { type: "JSXText", value, raw, ...at } as AST.JSXText;
  }
  return {
    type: "JSXExpressionContainer",
    expression: stringLiteral(value),
    ...at,
  } as AST.JSXExpressionContainer;
}

/**
 * A quoted attribute value, or a string expression when quoting cannot express it: JSX has no
 * escapes in quoted values but decodes character references in them, and the Qwik optimizer
 * turns a raw tab or line break in one into a space.
 */
function jsxAttributeValue(value: string): AST.JSXAttributeValue {
  if (!/["&]/.test(value) && !/[^\S ]/.test(value)) {
    return { type: "Literal", value, raw: `"${value}"`, ...at } as AST.StringLiteral;
  }
  return {
    type: "JSXExpressionContainer",
    expression: stringLiteral(value),
    ...at,
  } as AST.JSXExpressionContainer;
}
