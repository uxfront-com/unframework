// Serialisation of a live DOM subtree (browser only), for the DOM parity layer (L7).
//
// `innerHTML` alone cannot compare targets, because form-control state lives in properties
// that the attributes do not show: React sets `input.value` and `input.checked` as properties,
// while a static target writes `value` and `checked` attributes, and a user's typing changes
// only the property. The serialiser therefore writes that state as pseudo-attributes.
//
// Nodes are told apart by `nodeType`, `namespaceURI` and `localName`, not `instanceof`, so a
// subtree from another frame serialises the same way.
import { checkOptions, normalizeTree } from "../normalize/pipeline.ts";
import type { NormalizeOptions } from "../normalize/pipeline.ts";
import {
  attributeName,
  childrenOf,
  isElement as isTreeElement,
  isText as isTreeText,
  parseHtml,
} from "../normalize/tree.ts";
import type { TreeElement, TreeParent } from "../normalize/tree.ts";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

/** Namespace names for messages. */
const NAMESPACES: Readonly<Record<string, string>> = {
  [HTML_NAMESPACE]: "HTML",
  "http://www.w3.org/2000/svg": "SVG",
  "http://www.w3.org/1998/Math/MathML": "MathML",
};

const words = (list: string): ReadonlySet<string> => new Set(list.split(" "));

/** Elements that have no end tag. */
const VOID_ELEMENTS = words(
  "area base basefont bgsound br col embed frame hr img input keygen link meta param source track wbr",
);

/** Elements whose text the HTML parser reads raw, so it is written unescaped. */
const RAW_TEXT_ELEMENTS = words("iframe noembed noframes noscript plaintext script style xmp");

/** Elements whose first line break the HTML parser drops, so one is written in its place. */
const LEADING_NEWLINE_ELEMENTS = words("listing pre textarea");

/** Input types whose `value` property is the user's state (the "value" value mode). */
const VALUE_MODE_TYPES = words(
  "color date datetime-local email month number password range search tel text time url week",
);

const isElement = (node: Node): node is Element => node.nodeType === 1;
const isText = (node: Node): node is Text => node.nodeType === 3;
const isProcessingInstruction = (node: Node): node is ProcessingInstruction => node.nodeType === 7;
const isComment = (node: Node): node is Comment => node.nodeType === 8;

/** Whether `element` is the HTML element `<tag>`. */
function isHtml<Tag extends keyof HTMLElementTagNameMap>(
  element: Element,
  tag: Tag,
): element is HTMLElementTagNameMap[Tag] {
  return element.namespaceURI === HTML_NAMESPACE && element.localName === tag;
}

/** Whether the element has a CSSOM `style` (HTML, SVG and MathML elements do). */
const hasStyle = (element: Element): element is Element & ElementCSSInlineStyle =>
  "style" in element;

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * The form-control state an HTML element holds in properties, as `uf:*` pseudo-attributes:
 * - `uf:value` on a `<textarea>` and on an `<input>` whose value is user state (text-like,
 *   number, date, color, range…), from the `value` property;
 * - `uf:checked="true|false"` on checkboxes and radios, from `checked`;
 * - `uf:indeterminate="true|false"` on checkboxes, from `indeterminate`;
 * - `uf:selected="true|false"` on every `<option>`, from `selected`, which also covers a
 *   `<select>`'s value;
 * - `uf:focused=""` on the element that has the focus (see `focusState`).
 */
function formState(element: Element): [string, string][] {
  return [...controlState(element), ...focusState(element)];
}

/** The form-control state of `formState`, without the focus. */
function controlState(element: Element): [string, string][] {
  if (isHtml(element, "input")) {
    if (element.type === "checkbox") {
      return [
        ["uf:checked", String(element.checked)],
        ["uf:indeterminate", String(element.indeterminate)],
      ];
    }
    if (element.type === "radio") return [["uf:checked", String(element.checked)]];
    return VALUE_MODE_TYPES.has(element.type) ? [["uf:value", element.value]] : [];
  }
  if (isHtml(element, "textarea")) return [["uf:value", element.value]];
  if (isHtml(element, "option")) return [["uf:selected", String(element.selected)]];
  return [];
}

/**
 * `uf:focused=""` on the element that has the focus (`document.activeElement`), whatever its
 * namespace: an interaction that moves the focus, or loses it, shows in the DOM L7 and L9
 * compare. Playwright's ARIA snapshot marks it only in its AI mode, whose output differs by
 * target (ADR-0050). It is read whether the page has the focus or not (`hasFocus()` depends on
 * the frame's), and never on the body, which holds the focus when nothing else does.
 */
function focusState(element: Element): [string, string][] {
  const document = element.ownerDocument;
  return element === document.activeElement && element !== document.body
    ? [["uf:focused", ""]]
    : [];
}

/**
 * The element's attributes as they apply now. A `style` attribute is written as the CSSOM
 * serialises its declarations (`style.cssText`), so a style set through the CSSOM (React's
 * `el.style.margin = "0"`, which reads back as `margin: 0px;`) and the same style set as an
 * attribute (`margin:0`) compare equal.
 */
function attributesOf(element: Element): [string, string][] {
  return Array.from(element.attributes, (attribute): [string, string] => [
    attribute.name,
    attribute.name === "style" && hasStyle(element) ? element.style.cssText : attribute.value,
  ]);
}

/** The node holding an element's children: a `<template>`'s content, or the element. */
function holderOf(element: Element): Node {
  return isHtml(element, "template") ? element.content : element;
}

function serializeChildren(element: Element): string {
  const rawText =
    element.namespaceURI === HTML_NAMESPACE && RAW_TEXT_ELEMENTS.has(element.localName);
  let html = "";
  for (const child of holderOf(element).childNodes) {
    if (isElement(child)) html += serializeElement(child);
    else if (isText(child)) html += rawText ? child.data : escapeText(child.data);
    else if (isComment(child)) html += `<!--${child.data}-->`;
    else if (isProcessingInstruction(child)) html += `<?${child.target} ${child.data}>`;
  }
  return html;
}

function serializeElement(element: Element): string {
  const html = element.namespaceURI === HTML_NAMESPACE;
  const tag = element.localName;
  const attributes = [
    ...attributesOf(element),
    ...(html ? formState(element) : focusState(element)),
  ]
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");
  const start = `<${tag}${attributes}>`;
  if (html && VOID_ELEMENTS.has(tag)) return start;
  const content = serializeChildren(element);
  // Decided on the text as written, not on the first child: a framework's empty text node
  // in front of the line break must not stop the extra one.
  const newline = html && LEADING_NEWLINE_ELEMENTS.has(tag) && content.startsWith("\n");
  return `${start}${newline ? "\n" : ""}${content}</${tag}>`;
}

/**
 * Serialises the children of `root` (not `root` itself) to HTML, as `innerHTML` does, with two
 * differences that make the live state comparable:
 *
 * - form-control state is added as `uf:value`, `uf:checked`, `uf:indeterminate` and
 *   `uf:selected` pseudo-attributes, read from properties (see `formState`), and the element
 *   that has the focus is marked `uf:focused` (see `focusState`);
 * - `style` attributes are written as the CSSOM serialises them (see `attributesOf`).
 *
 * The result parses back into the same tree: a `<pre>`, `<textarea>` or `<listing>` whose text
 * starts with a line break gets the extra one the parser drops. Shadow roots are not included.
 */
export function serializeDom(root: Element): string {
  return serializeChildren(root);
}

/**
 * The canonical text of a live subtree: `normalizeHtml(serializeDom(root), options)`.
 *
 * Throws when the live DOM has a structure HTML cannot express, because the parser rebuilds it
 * differently and normalising the rebuilt tree would hide the difference: markup the parser
 * repairs (a `<div>` inside a `<p>`), every element or attribute whose namespace or name the
 * parser would infer otherwise, and text or attribute values it would read back changed. That
 * is an SVG child created in the HTML namespace (it renders nothing), `viewbox` set where SVG
 * needs `viewBox`, `xlink:href` set without its namespace, a `<table>` row without the
 * `<tbody>` the parser inserts, or a carriage return, which the parser turns into a line feed
 * (in a `<pre>`, one line becomes two).
 */
export function normalizeDom(root: Element, options: NormalizeOptions = {}): string {
  return normalizeDomWithIds(root, options).html;
}

/**
 * {@link normalizeDom}, with the renaming of the generated ids it found, from each original id
 * to its `uf-id-N`: a trace renames the ids a step's emitted payloads carry with it.
 */
export function normalizeDomWithIds(
  root: Element,
  options: NormalizeOptions = {},
): { html: string; ids: Map<string, string> } {
  checkOptions(options);
  const parsed = parseHtml(serializeDom(root));
  const mismatch = compareTrees(holderOf(root), parsed, "");
  if (mismatch) {
    throw new Error(
      `normalizeDom: the live DOM has a structure HTML cannot express, so the HTML parser would rebuild it differently: ${mismatch}`,
    );
  }
  const ids = new Map<string, string>();
  return { html: normalizeTree(parsed, options, ids), ids };
}

/** A child of a live or parsed node, as `compareTrees` walks it: adjacent text is one run. */
type Item<E> = { element: E } | { text: string } | { other: string };

/**
 * The children of a node as items: elements, runs of text (adjacent text nodes read back as
 * one, and empty text is not written), and the rest (comments, processing instructions).
 */
function itemsOf<N, E extends N>(
  children: Iterable<N>,
  kind: (node: N) => { element: E } | { text: string } | { other: string },
): Item<E>[] {
  const items: Item<E>[] = [];
  for (const child of children) {
    const item = kind(child);
    const last = items.at(-1);
    if ("text" in item && last && "text" in last) last.text += item.text;
    else items.push(item);
  }
  return items.filter((item) => !("text" in item) || item.text !== "");
}

/**
 * Walks the live children of `live` and the parsed children of `parsed` side by side, and
 * describes the first difference: an element whose namespace, name, attribute names or
 * attribute values differ, or that only one tree has, and text that reads back changed.
 */
function compareTrees(live: Node, parsed: TreeParent, path: string): string | undefined {
  const liveItems = itemsOf(live.childNodes, (node): Item<Element> => {
    if (isElement(node)) return { element: node };
    if (isText(node)) return { text: node.data };
    return { other: node.nodeName };
  });
  const parsedItems = itemsOf(childrenOf(parsed), (node): Item<TreeElement> => {
    if (isTreeElement(node)) return { element: node };
    if (isTreeText(node)) return { text: node.value };
    return { other: node.nodeName };
  });
  const where = path || "the root";
  for (let index = 0; index < Math.max(liveItems.length, parsedItems.length); index++) {
    const item = liveItems[index];
    const rebuilt = parsedItems[index];
    if (!item) return `the parser inserts ${describeItem(rebuilt!)} at ${where}.`;
    if (!rebuilt) return `the live ${describeItem(item)} at ${where} has no counterpart.`;
    if ("element" in item !== "element" in rebuilt) {
      return `the live ${describeItem(item)} at ${where} parses as ${describeItem(rebuilt)}.`;
    }
    if ("text" in item && "text" in rebuilt && item.text !== rebuilt.text) {
      return `the text ${JSON.stringify(item.text)} at ${where} reads back as ${JSON.stringify(rebuilt.text)}.`;
    }
    if (!("element" in item) || !("element" in rebuilt)) continue;
    const element = item.element;
    const here = `${path}${path ? " > " : ""}${element.localName}`;
    const mismatch =
      compareElements(element, rebuilt.element, here) ??
      compareTrees(holderOf(element), rebuilt.element, here);
    if (mismatch) return mismatch;
  }
  return undefined;
}

/** Describes the namespace, name and attributes in which a live element and its rebuild differ. */
function compareElements(element: Element, rebuilt: TreeElement, here: string): string | undefined {
  if (element.namespaceURI !== rebuilt.namespaceURI || element.localName !== rebuilt.tagName) {
    return `the live ${describe(element.namespaceURI, element.localName)} at ${here} parses as ${describe(rebuilt.namespaceURI, rebuilt.tagName)}.`;
  }
  const pseudo = new Set(
    (element.namespaceURI === HTML_NAMESPACE ? formState(element) : focusState(element)).map(
      ([name]) => name,
    ),
  );
  const liveValues = new Map(
    Array.from(element.attributes, (attribute): [string, string] => [
      liveAttributeKey(attribute),
      attribute.name === "style" && hasStyle(element) ? element.style.cssText : attribute.value,
    ]),
  );
  const parsedValues = new Map(
    rebuilt.attrs
      .filter((attribute) => !pseudo.has(attributeName(attribute)))
      .map((attribute): [string, string] => [parsedAttributeKey(attribute), attribute.value]),
  );
  const liveNames = [...liveValues.keys()].toSorted();
  const parsedNames = [...parsedValues.keys()].toSorted();
  if (liveNames.join("\n") !== parsedNames.join("\n")) {
    return `the attributes of ${here} are [${liveNames.join(", ")}] live and [${parsedNames.join(", ")}] once parsed.`;
  }
  for (const name of liveNames) {
    const value = liveValues.get(name)!;
    const read = parsedValues.get(name)!;
    if (value !== read) {
      return `the ${name} of ${here} is ${JSON.stringify(value)} live and reads back as ${JSON.stringify(read)}.`;
    }
  }
  return undefined;
}

/** A live or parsed item for a message: an element, text, or a comment. */
function describeItem(item: Item<Element> | Item<TreeElement>): string {
  if ("text" in item) return `text ${JSON.stringify(item.text)}`;
  if ("other" in item) return item.other;
  const element = item.element;
  return "localName" in element
    ? describe(element.namespaceURI, element.localName)
    : describe(element.namespaceURI, element.tagName);
}

/** An element for a message: `<circle>` in HTML, `SVG <circle>`. */
function describe(namespace: string | null | undefined, name: string): string {
  const label = NAMESPACES[namespace ?? ""] ?? namespace ?? "no namespace";
  return label === "HTML" ? `<${name}>` : `${label} <${name}>`;
}

/**
 * A live attribute's identity: its namespace and local name. A namespace declaration (`xmlns`,
 * `xmlns:xlink`) is inert in an HTML document, and frameworks set it without its namespace
 * (Vue's and React's `setAttribute("xmlns", …)`), so it is known by its qualified name alone.
 */
function liveAttributeKey(attribute: Attr): string {
  const declaration =
    attribute.namespaceURI === XMLNS_NAMESPACE ||
    (attribute.namespaceURI === null && /^xmlns(?::|$)/.test(attribute.name));
  return declaration ? attribute.name : qualified(attribute.namespaceURI, attribute.localName);
}

/** A parsed attribute's identity, as `liveAttributeKey` gives it. */
function parsedAttributeKey(attribute: TreeElement["attrs"][number]): string {
  return attribute.namespace === XMLNS_NAMESPACE
    ? attributeName(attribute)
    : qualified(attribute.namespace, attribute.name);
}

/** An attribute's namespace and local name, which together identify it. */
function qualified(namespace: string | null | undefined, name: string): string {
  return namespace ? `{${namespace}}${name}` : name;
}
