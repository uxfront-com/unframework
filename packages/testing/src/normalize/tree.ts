import { defaultTreeAdapter, html as spec, parseFragment } from "parse5";
import type { DefaultTreeAdapterTypes, ParserError, Token } from "parse5";

/** The parsed fragment the rules rewrite in place. */
export type TreeFragment = DefaultTreeAdapterTypes.DocumentFragment;
export type TreeParent = DefaultTreeAdapterTypes.ParentNode;
export type TreeChild = DefaultTreeAdapterTypes.ChildNode;
export type TreeElement = DefaultTreeAdapterTypes.Element;
export type TreeText = DefaultTreeAdapterTypes.TextNode;
export type TreeAttribute = Token.Attribute;

export const HTML_NAMESPACE: spec.NS = spec.NS.HTML;
export const SVG_NAMESPACE: spec.NS = spec.NS.SVG;
export const MATHML_NAMESPACE: spec.NS = spec.NS.MATHML;

/**
 * Parse errors that only flag a character the parser keeps as it is (a control character, a
 * noncharacter or a lone surrogate in the text). Every other error means the parser read the
 * markup differently from how it was written.
 */
const CHARACTER_ERRORS: ReadonlySet<string> = new Set([
  "control-character-in-input-stream",
  "noncharacter-in-input-stream",
  "surrogate-in-input-stream",
]);

/**
 * Elements the parser creates without a tag in the source, for markup HTML allows: a `<tbody>`
 * around rows written directly in a `<table>`, a `<colgroup>` around `<col>`s. Their start
 * tags are optional, so for HTML text this is not a repair: `<table><tr>` and
 * `<table><tbody><tr>` are the same document, as a browser builds it from server HTML. A live
 * DOM built without them is a different tree, which `normalizeDom` rejects.
 */
const IMPLIED_ELEMENTS: ReadonlySet<string> = new Set(["colgroup", "tbody"]);

interface Problem {
  offset: number;
  message: string;
}

/** A source excerpt for an error message. */
function excerpt(text: string): string {
  return JSON.stringify(text.length > 60 ? `${text.slice(0, 57)}...` : text);
}

/**
 * Parses HTML the way `element.innerHTML = html` does for an element in `<body>`: as a fragment
 * in a body context, with entities decoded and implied end tags closed.
 *
 * Markup the parser has to repair is rejected rather than normalised, because the repaired
 * tree would hide the difference. That is every tokenizer error (a duplicate attribute,
 * `<div/>`, an unterminated character reference) and every repair of the tree builder (see
 * `treeRepairs`).
 */
export function parseHtml(source: string): TreeFragment {
  const errors: ParserError[] = [];
  const context = defaultTreeAdapter.createElement("body", spec.NS.HTML, []);
  const fragment = parseFragment(context, source, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => {
      if (!CHARACTER_ERRORS.has(error.code)) errors.push(error);
    },
  });
  const problems = [
    ...errors.map((error) => ({ offset: error.startOffset, message: error.code })),
    ...treeRepairs(source, fragment),
  ].toSorted((a, b) => a.offset - b.offset);
  if (problems.length > 0) {
    const lines = problems.map(({ offset, message }) => `  ${position(source, offset)} ${message}`);
    throw new Error(
      `normalizeHtml: the HTML parser had to repair this markup, and normalising the repaired tree would hide the difference:\n${lines.join("\n")}`,
    );
  }
  return fragment;
}

/**
 * The tree builder's repairs, which it makes without reporting an error, found from the source
 * locations of the tree's nodes:
 * - `dropped`: source no node came from (a stray `</p>`, a table part outside a table, a
 *   document's `<html>`/`<head>`/`<body>`, a nested `<form>`);
 * - `moved`: a node out of source order (text foster-parented out of a `<table>`);
 * - `inserted`: an element with no tag in the source (a formatting element reopened after
 *   misnested tags, a `<tr>` around cells), apart from `IMPLIED_ELEMENTS`.
 */
function treeRepairs(source: string, fragment: TreeFragment): Problem[] {
  const problems: Problem[] = [];
  const covered = new Uint8Array(source.length);
  const quoted = (location: Token.Location) =>
    excerpt(source.slice(location.startOffset, location.endOffset));
  // The located node furthest into the source so far, in tree order.
  let furthest: Token.Location | undefined;
  const locate = (location: Token.Location | null | undefined) => {
    if (!location) return;
    covered.fill(1, location.startOffset, location.endOffset);
    if (furthest && location.startOffset < furthest.startOffset) {
      problems.push({
        offset: furthest.startOffset,
        message: `moved ${quoted(furthest)} before ${quoted(location)}`,
      });
    } else {
      furthest = location;
    }
  };
  const visit = (parent: TreeParent) => {
    for (const node of childrenOf(parent)) {
      if (!isElement(node)) {
        locate(node.sourceCodeLocation);
      } else if (node.sourceCodeLocation) {
        locate(node.sourceCodeLocation.startTag);
        visit(node);
        locate(node.sourceCodeLocation.endTag);
      } else {
        if (!IMPLIED_ELEMENTS.has(node.tagName)) {
          problems.push({
            offset: furthest?.endOffset ?? 0,
            message: `inserted <${node.tagName}>`,
          });
        }
        visit(node);
      }
    }
  };
  visit(fragment);
  let start = -1;
  for (let index = 0; index <= source.length; index++) {
    if (index < source.length && covered[index] === 0) {
      if (start < 0) start = index;
    } else if (start >= 0) {
      const text = source.slice(start, index);
      if (text.trim() !== "") problems.push({ offset: start, message: `dropped ${excerpt(text)}` });
      start = -1;
    }
  }
  return problems;
}

/** `line:column` (1-based) of an offset, for error messages. */
function position(source: string, offset: number): string {
  const before = source.slice(0, offset);
  return `${before.split("\n").length}:${offset - before.lastIndexOf("\n")}`;
}

export function isElement(node: TreeChild | TreeParent): node is TreeElement {
  return "tagName" in node;
}

export function isText(node: TreeChild): node is TreeText {
  return node.nodeName === "#text";
}

/** The node that holds a node's children: a `<template>`'s content fragment, or the node. */
function holderOf(node: TreeParent): TreeParent {
  return "content" in node && node.namespaceURI === HTML_NAMESPACE ? node.content : node;
}

/** The children of a node; a `<template>`'s are those of its content fragment. */
export function childrenOf(node: TreeParent): TreeChild[] {
  return holderOf(node).childNodes;
}

/** Replaces a node's children (a `<template>`'s content) with `children`, in place. */
export function replaceChildren(node: TreeParent, children: readonly TreeChild[]): void {
  const holder = holderOf(node);
  holder.childNodes.length = 0;
  for (const child of children) {
    child.parentNode = holder;
    holder.childNodes.push(child);
  }
}

/** Calls `visit` for every element under `root`, parents before children, in document order. */
export function forEachElement(root: TreeParent, visit: (element: TreeElement) => void): void {
  for (const node of childrenOf(root)) {
    if (isElement(node)) {
      visit(node);
      forEachElement(node, visit);
    }
  }
}

/** The attribute's name as written: `xlink:href` keeps its prefix. */
export function attributeName(attribute: TreeAttribute): string {
  return attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
}

/** An attribute's value, or `undefined` when the element does not have it. */
export function getAttribute(element: TreeElement, name: string): string | undefined {
  return element.attrs.find((attribute) => attributeName(attribute) === name)?.value;
}
