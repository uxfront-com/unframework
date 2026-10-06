import { styleValue } from "./style.ts";
import { getAttribute, HTML_NAMESPACE, MATHML_NAMESPACE, SVG_NAMESPACE } from "./tree.ts";
import type { TreeElement } from "./tree.ts";

/**
 * How an element takes part in its parent's inline formatting context, which is all the
 * whitespace rule needs to know about layout:
 * - `none`: not rendered; its content is normalised on its own.
 * - `contents`: no box; its children take its place.
 * - `inline`: a non-atomic inline box; whitespace collapses across its edges.
 * - `atomic`: an inline-level box that is content (an image, a control, an inline-block);
 *   whitespace on either side of it stays.
 * - `break`: `<br>`, a forced line break.
 * - `ruby-break`: `<br>` inside a ruby, which Chromium lays out as content on the line: the
 *   line neither ends nor breaks there.
 * - `block`: a block-level box; it ends the line before and after it.
 * - `out-of-flow`: a float or an absolutely positioned box. It neither breaks the line nor is
 *   content in it: whitespace collapses across it as if it were not there.
 */
export type Outer =
  | "none"
  | "contents"
  | "inline"
  | "atomic"
  | "break"
  | "ruby-break"
  | "block"
  | "out-of-flow";

export interface Box {
  outer: Outer;
  /** Whether the element is a flex or grid container, whose children are blockified. */
  blockifiesChildren: boolean;
  /**
   * Whether a whitespace-only text child renders nothing unless it follows text that does not
   * end in whitespace: Chromium's rule for the children of tables, table rows and sections,
   * and flex and grid containers (`Text::TextLayoutObjectIsNeeded`).
   */
  dropsWhitespaceChildren: boolean;
  /**
   * Whether the element is a ruby (`<ruby>`, `display: ruby`) or a ruby annotation (`<rt>` in a
   * ruby, `display: ruby-text`), whose content Chromium lays out on one line: see `boxOf` for
   * what it inlinifies.
   */
  rubyContent: boolean;
  /** Whether the element is a ruby annotation (`<rt>` in a ruby, `display: ruby-text`). */
  rubyAnnotation: boolean;
  /**
   * Whether the start and the end of the element's inline box are items of their own in
   * Blink's inline layout: a ruby's columns, and the bidi controls around an element whose
   * `unicode-bidi` is not `normal` (`<bdi>`, `<bdo>`, `<li>`, `dir="…"`). Whitespace collapses
   * across them, but they hide a zero-width space from a line break on the other side, which
   * then renders: `a\u200b<bdi>\nb</bdi>` is `a\u200b b`, where `a\u200b<b>\nb</b>` is
   * `a\u200bb`. An annotation's end is one, and so is its start, except where its parent is a
   * ruby container (`ParentLayout.rubyContainer`): in a ruby, `a\u200b<rt>\nb</rt>` is
   * `a\u200b<rt>b</rt>`. Anywhere else Chromium wraps the annotation in an anonymous ruby,
   * whose start is one.
   */
  opaqueStart: boolean;
  opaqueEnd: boolean;
  /**
   * Whether the element is a list item. Laid out inline (`display: inline list-item`, or
   * inlinified by a ruby), it starts with its marker: content that ends in a space, which takes
   * the whitespace after it.
   */
  listItem: boolean;
  /**
   * Whether the box is table-internal: a row group, a row, a column group, a column, a cell or
   * a caption, by its inline `display` or the user-agent default. Unless its parent is a table
   * part, CSS wraps it in an anonymous table (CSS 2.1 §17.2.1), an atomic `inline-table` when
   * the parent is an inline box, with rules for the whitespace around it this model does not
   * follow: the whitespace rule keeps that line as written. In a block container the wrapper
   * is a block-level `table`, which is what `outer` says.
   */
  tableInternal: boolean;
}

/** What the element's parent does to its box, besides what the element's own style says. */
export interface ParentLayout {
  /** The parent is a flex or grid container: it blockifies its children. */
  blockifies: boolean;
  /** The element is in a ruby's content: the ruby inlinifies it. */
  ruby: boolean;
  /**
   * The parent box is a ruby container itself (`display: ruby`, `inline ruby` or `block ruby`;
   * `display: contents` between them is no box), not an annotation or an element in one. An
   * annotation anywhere else gets an anonymous ruby around it.
   */
  rubyContainer: boolean;
}

const words = (list: string): ReadonlySet<string> => new Set(list.split(" "));

/** HTML elements with a block-level display (block, table parts) by default. */
const BLOCK_TAGS = words(
  "address article aside blockquote body caption center col colgroup dd details dialog dir div " +
    "dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 header hgroup " +
    "hr html legend listing main menu nav ol optgroup option p plaintext pre search section " +
    "summary table tbody td tfoot th thead tr ul xmp",
);

/** HTML elements whose default display is a table, a table row or section, or a column. */
const TABLE_TAGS = words("col colgroup table tbody tfoot thead tr");

/** HTML elements whose default display is table-internal (see `Box.tableInternal`). */
const TABLE_INTERNAL_TAGS = words("caption col colgroup tbody td tfoot th thead tr");

/** HTML elements that are replaced or inline-block by default. */
const ATOMIC_TAGS = words(
  "audio button canvas embed iframe img input marquee meter object progress select textarea video",
);

/** HTML elements with `display: none` by default. */
const NONE_TAGS = words(
  "area base basefont datalist head link meta noembed noframes param rp script style template title",
);

/**
 * HTML elements whose content keeps its whitespace: `white-space: pre` (`pre-wrap` for
 * `<textarea>`) in the user-agent stylesheet, and raw-text elements, whose text is code or is
 * not rendered as flowing text.
 */
const PRESERVING_TAGS = words(
  "iframe listing noembed noframes noscript plaintext pre script style textarea title xmp",
);

/** `white-space` and `white-space-collapse` keywords that keep spaces or line breaks. */
const PRESERVING_KEYWORDS = words(
  "pre pre-wrap pre-line break-spaces preserve preserve-breaks preserve-spaces",
);
const COLLAPSING_KEYWORDS = words("normal nowrap collapse");

/** SVG elements whose text flows inline inside a `<text>`; other SVG elements act as blocks. */
const SVG_INLINE_TAGS = words("a tspan textPath");

/** SVG elements whose text is code, kept exactly as it is, like HTML's raw-text elements. */
const SVG_PRESERVING_TAGS = words("script style");

/** `float` values that take a box out of flow. */
const FLOATING_KEYWORDS = words("left right inline-start inline-end");

/** `position` values that take a box out of flow. */
const OUT_OF_FLOW_POSITIONS = words("absolute fixed");

/** `unicode-bidi` values that wrap an element's content in bidi controls. */
const BIDI_KEYWORDS = words("embed isolate bidi-override isolate-override plaintext");

/** HTML elements whose `unicode-bidi` is not `normal` by default. */
const BIDI_TAGS = words("bdi bdo li output");

/** The `dir` values that make an HTML element `unicode-bidi: isolate` by default. */
const DIRECTIONS = words("ltr rtl auto");

/**
 * A box; by default its children are neither blockified nor dropped, ruby nor a list item, and
 * it is not table-internal.
 */
function box(
  outer: Outer,
  traits: Partial<Omit<Box, "outer" | "opaqueStart" | "opaqueEnd">> = {},
): Box {
  const blockifiesChildren = traits.blockifiesChildren ?? false;
  return {
    outer,
    blockifiesChildren,
    dropsWhitespaceChildren: traits.dropsWhitespaceChildren ?? blockifiesChildren,
    rubyContent: traits.rubyContent ?? false,
    rubyAnnotation: traits.rubyAnnotation ?? false,
    listItem: traits.listItem ?? false,
    tableInternal: traits.tableInternal ?? false,
    opaqueStart: false,
    opaqueEnd: false,
  };
}

/** Whether a node is the HTML element `<tag>`. */
function isHtmlElement(node: TreeElement["parentNode"], tag: string): boolean {
  return (
    node !== null &&
    "tagName" in node &&
    node.namespaceURI === HTML_NAMESPACE &&
    node.tagName === tag
  );
}

/**
 * Display a user-agent rule sets with `!important`, which no inline style overrides: hidden
 * inputs, and `<noscript>` (the parser and the browser both run with scripting enabled).
 */
function forcedBox(element: TreeElement): Box | undefined {
  if (element.namespaceURI !== HTML_NAMESPACE) return undefined;
  if (element.tagName === "noscript") return box("none");
  if (element.tagName === "input" && getAttribute(element, "type")?.toLowerCase() === "hidden") {
    return box("none");
  }
  return undefined;
}

/** The user-agent stylesheet's display for an element, per the HTML rendering section. */
function defaultBox(element: TreeElement): Box {
  const tag = element.tagName;
  if (element.namespaceURI === SVG_NAMESPACE) {
    if (tag === "svg") return box("atomic");
    if (tag === "style" || tag === "script") return box("none");
    return box(SVG_INLINE_TAGS.has(tag) ? "inline" : "block");
  }
  if (element.namespaceURI === MATHML_NAMESPACE) {
    // MathML lays out its own children and ignores whitespace between them.
    if (tag !== "math") return box("block");
    return box(getAttribute(element, "display")?.toLowerCase() === "block" ? "block" : "atomic");
  }
  const hidden = getAttribute(element, "hidden");
  if (hidden !== undefined && hidden.toLowerCase() !== "until-found" && tag !== "embed") {
    return box("none");
  }
  if (tag === "dialog" && getAttribute(element, "open") === undefined) return box("none");
  if (tag === "audio" && getAttribute(element, "controls") === undefined) return box("none");
  if (tag === "br") return box("break");
  if (tag === "slot") return box("contents");
  // `ruby { display: ruby }`, and `ruby > rt { display: ruby-text }`: an `<rt>` elsewhere is
  // an ordinary inline.
  if (tag === "ruby") return box("inline", { rubyContent: true });
  if (tag === "rt" && isHtmlElement(element.parentNode, "ruby")) {
    return box("inline", { rubyContent: true, rubyAnnotation: true });
  }
  if (tag === "li") return box("block", { listItem: true });
  if (NONE_TAGS.has(tag)) return box("none");
  const tableInternal = TABLE_INTERNAL_TAGS.has(tag);
  if (TABLE_TAGS.has(tag)) return box("block", { dropsWhitespaceChildren: true, tableInternal });
  if (BLOCK_TAGS.has(tag)) return box("block", { tableInternal });
  if (ATOMIC_TAGS.has(tag)) return box("atomic");
  // Every other element, custom elements included, has the initial `display: inline`.
  return box("inline");
}

/**
 * Reads a `display` value, single keyword or multi-keyword (`inline flow-root`). Returns
 * `undefined` for a value that defers to the user-agent default (`revert`, `inherit`, which
 * needs the parent's computed value) or that Chromium rejects (`run-in`, `ruby-base`).
 * `math` is a MathML layout: on any other element it computes to `flow`.
 */
export function boxFromDisplay(value: string, mathml = false): Box | undefined {
  const keywords = value.trim().split(/\s+/);
  if (keywords.length === 1) {
    switch (keywords[0]) {
      case "none":
        return box("none");
      case "contents":
        return box("contents");
      case "inline":
      case "initial":
      case "unset":
        return box("inline");
      case "ruby":
        return box("inline", { rubyContent: true });
      case "ruby-text":
        return box("inline", { rubyContent: true, rubyAnnotation: true });
      case "math":
        return box(mathml ? "atomic" : "inline");
      case "inline-block":
        return box("atomic");
      case "inline-table":
        return box("atomic", { dropsWhitespaceChildren: true });
      case "inline-flex":
      case "inline-grid":
        return box("atomic", { blockifiesChildren: true });
      case "table":
        return box("block", { dropsWhitespaceChildren: true });
      // Table-internal: the analyzer rejects a static one (UF1002), but a bound `display` gets
      // here with any value (see `Box.tableInternal`).
      case "table-row-group":
      case "table-header-group":
      case "table-footer-group":
      case "table-row":
      case "table-column-group":
      case "table-column":
        return box("block", { dropsWhitespaceChildren: true, tableInternal: true });
      case "table-cell":
      case "table-caption":
        return box("block", { tableInternal: true });
      case "block":
      case "flow":
      case "flow-root":
        return box("block");
      case "list-item":
        return box("block", { listItem: true });
      case "flex":
      case "grid":
        return box("block", { blockifiesChildren: true });
      default:
        return undefined;
    }
  }
  const has = (keyword: string) => keywords.includes(keyword);
  if (has("run-in")) return undefined;
  const inner = keywords.find((keyword) =>
    ["flow", "flow-root", "table", "flex", "grid", "ruby", "math"].includes(keyword),
  );
  const traits = {
    blockifiesChildren: inner === "flex" || inner === "grid",
    dropsWhitespaceChildren: inner === "flex" || inner === "grid" || inner === "table",
    rubyContent: inner === "ruby",
    listItem: has("list-item"),
  };
  const flows = inner === undefined || inner === "flow" || (inner === "math" && !mathml);
  if (has("inline")) return box(flows || inner === "ruby" ? "inline" : "atomic", traits);
  if (has("block") || has("list-item")) return box("block", traits);
  return undefined;
}

/**
 * The element's box: its inline `display` if it has a valid one, else the user-agent default,
 * as its parent lays it out:
 *
 * - A float or an absolutely positioned box (inline `float`, `position`) is out of flow, apart
 *   from `none` and `contents`, which have no box to take out.
 * - Inside a flex or grid container every other child is blockified.
 * - Blockified (out of flow, or in a flex or grid container), a table-internal box is a plain
 *   block container: no anonymous table wraps it, and its children are laid out as a block's.
 * - Inside a ruby, Chromium inlinifies: a block-level box becomes an inline-block (atomic),
 *   or an inline box if it is a list item or a ruby (`block ruby` becomes `inline ruby`); a
 *   float loses its float and is inlinified the same way; a `<br>` is content that does not break the line (`ruby-break`). An absolutely
 *   positioned box stays out of flow.
 *
 * Only inline styles and the user-agent defaults are read: a class whose stylesheet changes
 * `display`, `float`, `position` or `white-space` is invisible here. M0 has no stylesheets;
 * M4 brings them, and with them the live DOM path should read Chromium's computed styles
 * instead (the server path, L6, keeps this static reading and its limits).
 */
export function boxOf(element: TreeElement, parent: ParentLayout): Box {
  const placed = placedBox(element, parent);
  const bidi = isolatesBidi(element);
  return {
    ...placed,
    opaqueStart: (placed.rubyContent && !(placed.rubyAnnotation && parent.rubyContainer)) || bidi,
    opaqueEnd: placed.rubyContent || bidi,
  };
}

/** The element's box, laid out by its parent (see `boxOf`), its edges aside. */
function placedBox(element: TreeElement, parent: ParentLayout): Box {
  const forced = forcedBox(element);
  if (forced) return forced;
  const style = getAttribute(element, "style");
  const display = styleValue(style, "display");
  const declared =
    (display !== undefined
      ? boxFromDisplay(display, element.namespaceURI === MATHML_NAMESPACE)
      : undefined) ?? defaultBox(element);
  if (declared.outer === "none" || declared.outer === "contents") return declared;
  const position = styleValue(style, "position");
  const float = styleValue(style, "float");
  const floats = float !== undefined && FLOATING_KEYWORDS.has(float);
  const positioned = position !== undefined && OUT_OF_FLOW_POSITIONS.has(position);
  // Blockified, a table-internal box is a block container, in no anonymous table: its inner
  // display becomes `flow` (CSS Display 3 §2.7), so its children are laid out as a block's.
  const own =
    declared.tableInternal && (floats || positioned || parent.blockifies) ? box("block") : declared;
  if (positioned) return { ...own, outer: "out-of-flow" };
  if (parent.ruby) {
    // A float is blockified before the ruby drops its float, so it is inlinified as a block.
    if (floats || own.outer === "block") {
      return { ...own, outer: own.listItem || own.rubyContent ? "inline" : "atomic" };
    }
    return own.outer === "break" ? { ...own, outer: "ruby-break" } : own;
  }
  if (floats) return { ...own, outer: "out-of-flow" };
  if (
    parent.blockifies &&
    (own.outer === "inline" || own.outer === "atomic" || own.outer === "break")
  ) {
    return { ...own, outer: "block" };
  }
  return own;
}

/**
 * Whether the element's `unicode-bidi` is not `normal`: its inline style, else the user-agent
 * default, which isolates `<bdi>`, `<bdo>`, `<output>`, `<li>` and every HTML element with a
 * valid `dir` (`inherit` and `revert` defer to the default, as Chromium computes them).
 */
function isolatesBidi(element: TreeElement): boolean {
  const value = styleValue(getAttribute(element, "style"), "unicode-bidi");
  if (value === "normal" || value === "initial" || value === "unset") return false;
  if (value !== undefined && BIDI_KEYWORDS.has(value)) return true;
  if (element.namespaceURI !== HTML_NAMESPACE) return false;
  const dir = getAttribute(element, "dir")?.toLowerCase();
  return BIDI_TAGS.has(element.tagName) || (dir !== undefined && DIRECTIONS.has(dir));
}

/**
 * Whether the element's text keeps its whitespace. Inherited, and overridden by an inline
 * `white-space` or `white-space-collapse`. `pre-line` (`preserve-breaks`) counts as
 * preserving: keeping more whitespace than the browser renders never hides a difference.
 */
export function preservesWhitespace(element: TreeElement, inherited: boolean): boolean {
  const value = styleValue(getAttribute(element, "style"), "white-space", "white-space-collapse");
  const keywords = value?.split(/\s+/) ?? [];
  if (keywords.some((keyword) => PRESERVING_KEYWORDS.has(keyword))) return true;
  if (keywords.some((keyword) => COLLAPSING_KEYWORDS.has(keyword))) return false;
  return (
    inherited ||
    (element.namespaceURI === HTML_NAMESPACE && PRESERVING_TAGS.has(element.tagName)) ||
    (element.namespaceURI === SVG_NAMESPACE && SVG_PRESERVING_TAGS.has(element.tagName))
  );
}
