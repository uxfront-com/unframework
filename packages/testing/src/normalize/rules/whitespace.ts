import { boxOf, preservesWhitespace } from "../display.ts";
import type { Box } from "../display.ts";
import { childrenOf, HTML_NAMESPACE, isElement, isText, replaceChildren } from "../tree.ts";
import type { TreeChild, TreeElement, TreeParent, TreeText } from "../tree.ts";

/** The whitespace `white-space: normal` collapses: spaces, tabs and line breaks (not U+00A0). */
const COLLAPSIBLE = /[ \t\n\r]+/g;

/** A segment break: a line break in the source text. */
const SEGMENT_BREAK = /[\n\r]/;

/** Text that is nothing but collapsible whitespace. */
const WHITESPACE_ONLY = /^[ \t\n\r]*$/;

/** Text whose last character is ASCII whitespace, as Chromium's layout tree builder tests it. */
const ENDS_WITH_WHITESPACE = /[ \t\n\f\r]$/;

/** U+200B ZERO WIDTH SPACE, next to which a segment break is removed, not rendered as a space. */
const ZWSP = "\u200B";

/** The state of the line being laid out in one inline formatting context. */
interface Line {
  /** Nothing has been rendered on the line yet, so a leading space is dropped. */
  atStart: boolean;
  /** The text whose final collapsible space is the last thing rendered so far, if any. */
  trailing: TreeText | null;
  /** That space stands for whitespace with a segment break in it. */
  trailingBreak: boolean;
  /** The character before that space is a zero-width space (U+200B, or a `<wbr>`). */
  trailingAfterZeroWidthSpace: boolean;
  /** That space follows whitespace this rule does not collapse (see `afterUncollapsed`). */
  trailingAfterUncollapsed: boolean;
  /** The last thing rendered is a U+200B or a `<wbr>`. */
  afterZeroWidthSpace: boolean;
  /**
   * The last thing rendered is whitespace this rule does not collapse: preserved text ending in
   * a space or tab, or whitespace kept as written. A line break after it is kept as written.
   */
  afterUncollapsed: boolean;
  /** The last text laid out, when all of it collapsed away and nothing rendered after it. */
  emptied: TreeText | null;
  /** A ruby or an annotation ended, and nothing rendered after it. */
  afterRuby: boolean;
}

/**
 * Texts that collapsed away beside a ruby, which stay in the tree, empty (see `emptied`). Only
 * this rule leaves empty text, which prints as `""`.
 */
const keptEmpty = new WeakSet<TreeText>();

/**
 * What came before a node among the children of the nearest element with a box (`display:
 * contents` has none), for Chromium's choice of the whitespace-only texts it renders at all
 * (`Text::TextLayoutObjectIsNeeded`). A `<q>`'s `::before` quotation mark counts, as an inline;
 * floats, absolutely positioned boxes, elements that are not rendered and texts it renders
 * nothing for do not.
 */
type Previous =
  /** Nothing yet. */
  | "none"
  /** A text that ends in whitespace as written, even if that whitespace was removed. */
  | "text-ending-in-whitespace"
  | "text"
  /** An inline box: a non-atomic inline, or an atomic one. */
  | "inline"
  /** A block-level box, or `<br>`. */
  | "other";

interface Context {
  /** The text keeps its whitespace (`pre`, `textarea`, an inline `white-space: pre…`). */
  preserve: boolean;
  /** The parent is a flex or grid container, so its children are blockified. */
  blockify: boolean;
  /** The parent renders a whitespace-only text child only after text (see `Box`). */
  dropsWhitespace: boolean;
  /** The parent is a non-atomic inline box, which renders a whitespace-only first child. */
  inline: boolean;
  /** The content is a ruby's, which inlinifies what it holds (see `boxOf`). */
  ruby: boolean;
  /** The parent box is a ruby container (see `ParentLayout.rubyContainer`). */
  rubyContainer: boolean;
  /**
   * The line holds a table-internal box in an anonymous inline table (see `inInlineTable`):
   * its whitespace is kept as written.
   */
  keep: boolean;
  previous: Previous;
}

/**
 * Rule 6: collapses whitespace the way Chromium renders it under `white-space: normal` (CSS
 * Text 3, phases I and II, as Blink's inline items builder implements them), so markup that
 * renders the same text prints the same, and markup that renders differently stays different.
 * Where the result depends on more than a static reading can see, whitespace is kept as
 * written: two outputs then compare equal only if they wrote it alike, a loud difference rather
 * than a hidden one.
 *
 * - Runs of spaces, tabs and line breaks become one space, and a space that follows another
 *   collapsible space on the same line goes, even across inline element boundaries
 *   (`a <b> b</b>` is `"a "`, `<b>"b"</b>`). Line breaks become spaces, as Chromium renders
 *   them (CSS's East Asian segment-break rules are not applied).
 * - Next to a zero-width space, a line break goes with the spaces around it: in a text, a run
 *   with a line break between U+200B (or a `<wbr>`) and anything, or before U+200B, renders
 *   nothing, and so does the pending space of an earlier text when this one starts so. The
 *   edge of a ruby or a bidi isolate (`dir`, `<bdi>`), and the end of a ruby annotation, hides
 *   a U+200B from a line break on its other side (`Box.opaqueStart`, `Box.opaqueEnd`).
 * - A whitespace-only text Chromium does not render at all (after text that ends in
 *   whitespace, after a block or `<br>`, as the first child of a block; in a table or a flex or
 *   grid container, anywhere but after text) takes no part, not even in those removals.
 * - Spaces at the start and end of a line go: at the edges of a block's inline content, next
 *   to a block-level sibling, and around `<br>` (not before one in preserved whitespace). So Svelte's `" "` between two blocks vanishes,
 *   and Vue's condensed `<p>\n  Line one<br>Line two\n</p>` equals React's
 *   `<p>Line one<br>Line two</p>`.
 * - A space next to an atomic inline (an image, a control, an inline-block) is content and
 *   stays: `<img> <input>` and `<img><input>` stay different, as they render differently. So
 *   does a space inside a `<q>`, next to the quotation marks it generates.
 * - A float or an absolutely positioned box is not there as far as the line is concerned:
 *   whitespace collapses across it, and its own content is laid out on its own.
 * - Each element's box comes from its inline `display` or the user-agent default (see
 *   `display.ts`): block-level boxes break lines, inline boxes are transparent, `display:
 *   contents` children take its place, flex and grid children are blockified, and elements
 *   that are not rendered are normalised on their own. A ruby lays its content out on one
 *   line: a `<br>`, a block or a float inside it, or a preserved line break, does not end it;
 *   a list item there is an inline that starts with its marker.
 * - A table-internal box (a cell, a row, a caption, …) whose parent is an inline box sits in
 *   an anonymous inline table, which Chromium builds with whitespace rules of its own (a
 *   whitespace-only text after it renders nothing, and the next table-internal sibling joins
 *   it): every whitespace of that line, and of the box's own content, is kept as written. In
 *   a block container it is a block-level table, a block; blockified, a block container.
 * - Text that keeps its whitespace (`pre`, `textarea`, `listing`, `plaintext`, raw-text
 *   elements, SVG `<style>` and `<script>`, and inline `white-space: pre`, `pre-wrap`,
 *   `pre-line` or `break-spaces`, which is inherited) is left exactly as it is. A collapsible
 *   line break after a preserved space or tab is kept as written: Chromium removes it, with
 *   the spaces before it, or renders it, depending on the texts around it.
 *
 * Text this rule empties is removed, except beside a ruby, where it stays, empty (`emptied`).
 * Soft wraps depend on the viewport, so a space at the end of a wrapped line stays.
 */
export function collapseWhitespace(root: TreeParent): void {
  formatBlock(root, {
    preserve: false,
    blockify: false,
    dropsWhitespace: false,
    ruby: false,
    rubyContainer: false,
  });
  removeEmptyText(root);
}

/** Lays out a block container's content as one inline formatting context. */
function formatBlock(
  container: TreeElement | TreeParent,
  context: Pick<Context, "preserve" | "blockify" | "dropsWhitespace" | "ruby" | "rubyContainer">,
  quotes = false,
): void {
  const line: Line = {
    atStart: true,
    trailing: null,
    trailingBreak: false,
    trailingAfterZeroWidthSpace: false,
    trailingAfterUncollapsed: false,
    afterZeroWidthSpace: false,
    afterUncollapsed: false,
    emptied: null,
    afterRuby: false,
  };
  const keep = holdsInlineTable(container, { ...context, inline: false });
  if (quotes) renderContent(line);
  flow(container, line, { ...context, inline: false, keep, previous: quotes ? "inline" : "none" });
  if (quotes) renderContent(line);
  endLine(line);
}

/**
 * Whether a table-internal box sits in an anonymous inline table: its parent is an inline box
 * (CSS 2.1 §17.2.1), a blockified ruby's inline ruby included. A blockified one is a block
 * container already (see `boxOf`).
 */
function inInlineTable(box: Box, context: Pick<Context, "inline" | "ruby">): boolean {
  return box.tableInternal && (context.inline || context.ruby);
}

/**
 * Whether a block container's line holds a box in an anonymous inline table, through inline
 * boxes and `display: contents`, as `flow` lays them out: if so, the line's whitespace is
 * kept as written.
 */
function holdsInlineTable(
  parent: TreeParent,
  context: Pick<Context, "blockify" | "ruby" | "rubyContainer" | "inline">,
): boolean {
  return childrenOf(parent).some((node) => {
    if (!isElement(node)) return false;
    const box = childBox(node, context);
    if (inInlineTable(box, context)) return true;
    if (box.outer === "contents") return holdsInlineTable(node, context);
    return (
      box.outer === "inline" &&
      holdsInlineTable(node, {
        blockify: false,
        ruby: context.ruby || box.rubyContent,
        rubyContainer: isRubyContainer(box),
        inline: true,
      })
    );
  });
}

/** A child's box, as its parent lays it out. */
function childBox(
  node: TreeElement,
  context: Pick<Context, "blockify" | "ruby" | "rubyContainer">,
): Box {
  return boxOf(node, {
    // `<wbr>` lays out as text (an empty one), which a flex or grid container does not blockify.
    blockifies: context.blockify && !isHtml(node, "wbr"),
    ruby: context.ruby,
    rubyContainer: context.rubyContainer,
  });
}

/** Whether a box is a ruby container, not an annotation (see `ParentLayout.rubyContainer`). */
function isRubyContainer(box: Box): boolean {
  return box.rubyContent && !box.rubyAnnotation;
}

/**
 * Lays out a node's children into the current line. Returns what came last among them, for a
 * `display: contents` parent's next sibling.
 */
function flow(parent: TreeParent, line: Line, context: Context): Previous {
  let previous = context.previous;
  for (const node of childrenOf(parent)) {
    if (isText(node)) {
      // A line kept as written renders its texts as they are (see `holdsInlineTable`).
      if (context.keep) continue;
      const text = node.value;
      if (!rendersText(text, previous, context)) {
        node.value = "";
        continue;
      }
      if (context.preserve) renderPreserved(node, line, context.ruby);
      else collapseText(node, line);
      if (node.value === "") emptied(node, line);
      previous = ENDS_WITH_WHITESPACE.test(text) ? "text-ending-in-whitespace" : "text";
      continue;
    }
    if (!isElement(node)) continue;
    const box = childBox(node, context);
    // Its content is kept as written too.
    if (inInlineTable(box, context)) continue;
    const inner = {
      preserve: preservesWhitespace(node, context.preserve),
      blockify: box.blockifiesChildren,
      dropsWhitespace: box.dropsWhitespaceChildren,
      ruby: box.rubyContent,
      rubyContainer: isRubyContainer(box),
    };
    const quotes = generatesQuotes(node);
    switch (box.outer) {
      case "none":
      case "out-of-flow":
        // Not in the flow: the line, and the choice of whitespace, go on as without it.
        formatBlock(node, inner, quotes);
        break;
      case "contents":
        // Its children are its parent's, for blockification and whitespace alike.
        previous = flow(node, line, { ...context, preserve: inner.preserve, previous });
        break;
      case "inline":
        if (quotes) renderContent(line);
        // Its edges hide a zero-width space from a line break on the other side (see `Box`).
        if (box.opaqueStart) line.afterZeroWidthSpace = false;
        // A text that collapsed away right before a ruby stays (see `emptied`).
        if (box.rubyContent && line.emptied) keptEmpty.add(line.emptied);
        if (box.listItem) {
          // Its marker (`• `) is content, and its space takes the whitespace that follows.
          renderContent(line);
          line.atStart = true;
        }
        flow(node, line, {
          ...inner,
          blockify: false,
          dropsWhitespace: false,
          inline: true,
          ruby: context.ruby || inner.ruby,
          keep: context.keep,
          previous: quotes ? "inline" : "none",
        });
        if (quotes) renderContent(line);
        if (box.opaqueEnd) line.afterZeroWidthSpace = false;
        if (box.rubyContent) line.afterRuby = true;
        if (isHtml(node, "wbr")) {
          // Its layout object is an empty text: a whitespace-only text after it renders.
          line.afterZeroWidthSpace = true;
          previous = "text";
        } else {
          previous = "inline";
        }
        break;
      case "atomic":
        renderContent(line);
        formatBlock(node, inner, quotes);
        previous = "inline";
        break;
      case "ruby-break":
        // Content that ends nothing; as after any `<br>`, a whitespace-only text renders nothing.
        renderContent(line);
        previous = "other";
        break;
      case "break":
        // A forced break; where whitespace is preserved, a collapsible space before it stays.
        if (inner.preserve) {
          renderContent(line);
          line.atStart = true;
        } else {
          endLine(line);
        }
        previous = "other";
        break;
      case "block":
        endLine(line);
        formatBlock(node, inner, quotes);
        endLine(line);
        previous = "other";
        break;
    }
  }
  return previous;
}

/**
 * Whether Chromium renders a text at all (`Text::TextLayoutObjectIsNeeded`). A text with more
 * than collapsible whitespace always renders; a whitespace-only one renders after text that
 * does not end in whitespace, and, in a parent that is not a table, flex or grid container,
 * after an inline box, or first in an inline box.
 */
function rendersText(text: string, previous: Previous, context: Context): boolean {
  if (text === "") return false;
  if (context.preserve || !WHITESPACE_ONLY.test(text)) return true;
  if (previous === "text") return true;
  if (context.dropsWhitespace) return false;
  return previous === "inline" || (previous === "none" && context.inline);
}

/**
 * Collapses one text's whitespace against the line so far, run by run, as Blink's inline items
 * builder does (`AppendCollapseWhitespace`). A run inside the text knows its neighbours; the
 * text's first run meets the line: the pending space of an earlier text, or what was rendered
 * last.
 */
function collapseText(node: TreeText, line: Line): void {
  const source = node.value;
  const whitespaceOnly = WHITESPACE_ONLY.test(source);
  let out = "";
  let previous = "";
  let index = 0;
  const glyphs = (text: string) => {
    if (text === "") return;
    // A text that starts with glyphs, after an earlier text's line break: next to a zero-width
    // space on either side, the space that break became goes.
    if (
      index === 0 &&
      line.trailing !== null &&
      line.trailingBreak &&
      (line.trailingAfterZeroWidthSpace || text.startsWith(ZWSP))
    ) {
      line.trailing.value = line.trailing.value.slice(0, -1);
    }
    out += text;
    renderContent(line);
    line.afterZeroWidthSpace = text.endsWith(ZWSP);
    previous = text;
  };
  for (const match of source.matchAll(COLLAPSIBLE)) {
    glyphs(source.slice(index, match.index));
    const run = match[0];
    const first = match.index === 0;
    index = match.index + run.length;
    const segmentBreak = SEGMENT_BREAK.test(run);
    const nextIsZeroWidthSpace = source.startsWith(ZWSP, index);
    if (!first) {
      // Between two pieces of this text: both neighbours are known.
      if (segmentBreak && (previous.endsWith(ZWSP) || nextIsZeroWidthSpace)) continue;
      out += " ";
      pend(line, node, segmentBreak, previous.endsWith(ZWSP));
      continue;
    }
    if (line.atStart) continue;
    if (line.trailing !== null) {
      const breaks = segmentBreak || line.trailingBreak;
      if (segmentBreak && line.trailingAfterUncollapsed) {
        out += run;
        renderUncollapsed(line);
      } else if (
        breaks &&
        (line.trailingAfterZeroWidthSpace || nextIsZeroWidthSpace) &&
        !whitespaceOnly
      ) {
        // Blink removes the pending space for a whitespace-only text too, but puts it back
        // as soon as more text or an atomic inline follows: only this text's own glyphs keep
        // it removed.
        dropTrailing(line);
      }
      // Otherwise it collapses into the pending space.
      continue;
    }
    if (segmentBreak && line.afterUncollapsed) {
      out += run;
      renderUncollapsed(line);
      continue;
    }
    if (segmentBreak && (line.afterZeroWidthSpace || nextIsZeroWidthSpace)) continue;
    out += " ";
    pend(line, node, segmentBreak, line.afterZeroWidthSpace);
  }
  glyphs(source.slice(index));
  node.value = out;
}

/** Records the collapsible space just written at the end of `node` as the line's pending one. */
function pend(
  line: Line,
  node: TreeText,
  segmentBreak: boolean,
  afterZeroWidthSpace: boolean,
): void {
  const afterUncollapsed = line.afterUncollapsed;
  renderContent(line);
  line.trailing = node;
  line.trailingBreak = segmentBreak;
  line.trailingAfterZeroWidthSpace = afterZeroWidthSpace;
  line.trailingAfterUncollapsed = afterUncollapsed;
}

/** Removes the pending space; the line is back to what was rendered before it. */
function dropTrailing(line: Line): void {
  const afterZeroWidthSpace = line.trailingAfterZeroWidthSpace;
  line.trailing!.value = line.trailing!.value.slice(0, -1);
  renderContent(line);
  line.afterZeroWidthSpace = afterZeroWidthSpace;
}

/**
 * Lays out text that keeps its whitespace: every character of it is rendered. A preserved line
 * break ends the line, except in a ruby, which lays its content out on one line; what a line
 * break after preserved text in a ruby renders is not modelled, so it is kept as written.
 */
function renderPreserved(node: TreeText, line: Line, ruby: boolean): void {
  renderContent(line);
  line.atStart = !ruby && node.value.endsWith("\n");
  line.afterZeroWidthSpace = node.value.endsWith(ZWSP);
  line.afterUncollapsed = ruby || /[ \t]$/.test(node.value);
}

/** Whitespace was kept as written: a line break after it is not known either. */
function renderUncollapsed(line: Line): void {
  renderContent(line);
  line.afterUncollapsed = true;
}

/**
 * A text Chromium lays out stays an item of the line when all of it collapses away, and beside a
 * ruby (or an annotation) that item shows: an annotation overhangs the space next to it only
 * when nothing comes between them. So a text that collapses away right before or after a ruby
 * stays in the tree, empty.
 */
function emptied(node: TreeText, line: Line): void {
  if (line.afterRuby) keptEmpty.add(node);
  line.emptied = node;
}

/** Something visible was rendered: the pending space stays, and the line has begun. */
function renderContent(line: Line): void {
  line.emptied = null;
  line.afterRuby = false;
  line.atStart = false;
  line.trailing = null;
  line.trailingBreak = false;
  line.trailingAfterZeroWidthSpace = false;
  line.trailingAfterUncollapsed = false;
  line.afterZeroWidthSpace = false;
  line.afterUncollapsed = false;
}

/** Ends the line: its trailing collapsible space is not rendered. */
function endLine(line: Line): void {
  if (line.trailing !== null) line.trailing.value = line.trailing.value.slice(0, -1);
  renderContent(line);
  line.atStart = true;
}

/** HTML's `<q>`, whose user-agent `::before` and `::after` render quotation marks. */
function generatesQuotes(element: TreeElement): boolean {
  return isHtml(element, "q");
}

function isHtml(element: TreeElement, tag: string): boolean {
  return element.namespaceURI === HTML_NAMESPACE && element.tagName === tag;
}

/** Whether a node is text this rule emptied and does not keep (see `emptied`). */
function isRemovable(node: TreeChild): boolean {
  return isText(node) && node.value === "" && !keptEmpty.has(node);
}

function removeEmptyText(parent: TreeParent): void {
  const children = childrenOf(parent);
  if (children.some(isRemovable)) {
    replaceChildren(
      parent,
      children.filter((node) => !isRemovable(node)),
    );
  }
  for (const node of childrenOf(parent)) {
    if (isElement(node)) removeEmptyText(node);
  }
}
