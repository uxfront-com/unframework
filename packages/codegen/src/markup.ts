import type { ElementNode, StaticAttribute } from "@unframework/ir";

import { isBlockElement, isVoidElement, WHITESPACE_PRESERVING_ELEMENTS } from "./html.ts";

/** Where a text node sits, for the dialects whose compilers treat edges differently. */
export interface TextPosition {
  /** The element whose child the text is. */
  parent: ElementNode;
  /** Whether the text is the parent's first child. */
  first: boolean;
  /** Whether the text is the parent's last child. */
  last: boolean;
}

/**
 * How a template language writes markup, and how its compiler treats whitespace. The printer and
 * the dialect together guarantee that the framework renders exactly the IR's DOM; each target's
 * render-parity test checks that with the framework's own compiler and server renderer.
 */
export interface MarkupDialect {
  name: string;
  /**
   * Writes a text node so that the template compiler produces exactly its value: entities,
   * the language's own delimiters (`{{`, `{`, `@`), and any whitespace the compiler would
   * otherwise collapse or drop.
   */
  escapeText(text: string, position: TextPosition): string;
  /**
   * Writes a static attribute of a `tag` element so that the element gets exactly this value:
   * `name="…"` with the value escaped, or the language's binding when a static value cannot
   * express it.
   */
  attribute(name: string, value: string, tag: string): string;
  /** `<br />` or `<br>`. */
  voidElement: "self-closing" | "html";
  /**
   * Whether the template compiler drops whitespace-only text that holds a line break and sits
   * between two elements (Vue's `condense`, Angular's whitespace removal, Astro's JSX rules), so
   * the printer may break the line there. Otherwise it breaks inside a tag (`</li\n><li>`).
   */
  stripsWhitespaceBetweenElements: boolean;
  /**
   * Whether it drops whitespace-only text at the start and end of an element's content, so the
   * printer may break lines there. Otherwise an element's children stay on its own line.
   */
  stripsEdgeWhitespace: boolean;
  /**
   * The region an element must be printed in, when the language would read one of its static
   * attribute values as a binding and no escape can stop it (Angular's `{{`).
   */
  literalRegion?(element: ElementNode): LiteralRegion | undefined;
}

/**
 * A wrapper inside which a template language reads markup as written: no bindings and no
 * whitespace processing. The printer writes the element in it with the region's own dialect,
 * on the wrapper's line, breaking lines only inside tags.
 */
export interface LiteralRegion {
  /** The wrapper's opening tag. */
  open: string;
  /** The wrapper's closing tag. */
  close: string;
  /** How the element and its subtree are written inside the wrapper. */
  dialect: MarkupDialect;
}

/** HTML's own whitespace, which Svelte trims at the edges of an element's content. */
const HTML_WHITESPACE = /[\t\n\f\r ]/;
/** Whitespace Vue's `condense` mode rewrites: tabs, breaks and runs (Vue's `isWhitespace` set). */
const VUE_CONDENSED = /[\t\n\f\r]|[\t\n\f\r ]{2}/;
const VUE_WHITESPACE_ONLY = /^[\t\n\f\r ]+$/;
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
/** Line breaks and tabs, which JSX-style whitespace rules (Astro's `compressHTML`) rewrite. */
const JSX_WHITESPACE = /[\t\n\r]/;

/**
 * Text as HTML reads it back: `&` and `<` as references, no-break spaces visible, and carriage
 * returns as references, because HTML turns a raw one into a line feed.
 */
const escapeHtmlText = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\u00a0/g, "&nbsp;")
    .replace(/\r/g, "&#13;");

/** A double-quoted attribute value, with the same references as text plus `"`. */
const escapeHtmlAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/\u00a0/g, "&nbsp;")
    .replace(/\r/g, "&#13;");

/** Each UTF-16 code unit of the text as a `\uXXXX` escape. */
const unicodeEscape = (text: string) =>
  text.replace(/[\s\S]/g, (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`);

/**
 * A string literal for a template expression (`{{ … }}`, `{…}`): JSON escaping, plus `\u`
 * escapes for what the template's own scanner would read before the expression parser does.
 * Vue and Angular decode entities inside `{{ }}` and Vue ends one at the first `}}`, Angular
 * and HTML-aware tools see markup in `<` and `>`, and line separators are line breaks to some
 * JavaScript tools.
 */
const stringLiteral = (text: string) =>
  JSON.stringify(text).replace(/[&<>{}\u2028\u2029]/g, unicodeEscape);

/** A string literal in single quotes, escaped as the value of a double-quoted attribute binding. */
function boundLiteral(value: string): string {
  const body = stringLiteral(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'");
  return escapeHtmlAttribute(`'${body}'`);
}

/** `name="value"`, escaped as HTML reads it back. */
const quotedAttribute = (name: string, value: string) => `${name}="${escapeHtmlAttribute(value)}"`;

/** Plain HTML: text and attributes are exactly what is written, so lines never break. */
export const htmlDialect: MarkupDialect = {
  name: "html",
  escapeText: escapeHtmlText,
  attribute: quotedAttribute,
  voidElement: "html",
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: false,
};

/** Whether the text sits where the compiler keeps whitespace as written (`<pre>`, `<textarea>`). */
const keepsWhitespace = (position: TextPosition) =>
  WHITESPACE_PRESERVING_ELEMENTS.has(position.parent.tag);

/**
 * Vue templates: `{{` opens an interpolation, and the `condense` whitespace mode turns any tab,
 * line break or run of whitespace in text into one space, drops whitespace-only text that is
 * an element's first or last child, and turns `\r\n` into `\n` even in `<pre>`. Such text is
 * printed as an interpolated string literal, which Vue renders as it is. Vue's server compiler
 * writes static attributes into a template literal, which turns a carriage return into a line
 * feed, so a value holding one is bound to a string literal instead.
 *
 * `condense` is @vitejs/plugin-vue's default, and an SFC cannot pin its own: with a consumer's
 * `whitespace: "preserve"`, the layout's line breaks would become text between the elements.
 * Deferred to M6 (plan §8.2): the unplugin reads the Vue plugin's resolved option and reports
 * any other value.
 */
export const vueDialect: MarkupDialect = {
  name: "vue",
  escapeText: (text, position) => {
    const condensed = keepsWhitespace(position)
      ? text.includes("\r")
      : VUE_CONDENSED.test(text) ||
        ((position.first || position.last) && VUE_WHITESPACE_ONLY.test(text));
    return condensed
      ? `{{ ${stringLiteral(text)} }}`
      : escapeHtmlText(text).replace(/\{\{/g, "{&#123;");
  },
  attribute: (name, value) =>
    value.includes("\r") ? `:${name}="${boundLiteral(value)}"` : quotedAttribute(name, value),
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: true,
  stripsEdgeWhitespace: true,
};

/**
 * Svelte markup: `{` opens an expression or a block, in text and in attribute values. Svelte
 * removes the whitespace at the start and end of an element's content and turns whitespace
 * between text and an element into one space, so text that holds line breaks, tabs or runs of
 * spaces, or whitespace at an edge, is printed as an expression. Whitespace between two
 * elements becomes a space, so the printer never leaves any there. That is
 * `preserveWhitespace: false`, Svelte's default, which the Svelte target pins in every
 * component (`<svelte:options>`).
 *
 * Svelte's server renderer escapes the static attributes of an `<option>` twice (5.57: the
 * compiler escapes them into the `$$renderer.option()` call, which escapes them again), so
 * `title="a<b"` renders `a&amp;lt;b`. An option's value holding `&`, `<` or `"` is an
 * expression, which is escaped once.
 */
export const svelteDialect: MarkupDialect = {
  name: "svelte",
  escapeText: (text, position) => {
    if (keepsWhitespace(position)) return escapeBraces(escapeHtmlText(text));
    const atEdge =
      (position.first && HTML_WHITESPACE.test(text.charAt(0))) ||
      (position.last && HTML_WHITESPACE.test(text.charAt(text.length - 1)));
    return atEdge || VUE_CONDENSED.test(text)
      ? `{${stringLiteral(text)}}`
      : escapeBraces(escapeHtmlText(text));
  },
  attribute: (name, value, tag) =>
    tag === "option" && /[&<"]/.test(value)
      ? `${name}={${stringLiteral(value)}}`
      : `${name}="${escapeBraces(escapeHtmlAttribute(value))}"`,
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: true,
};

/**
 * Angular templates: `{{` interpolates even when written as entities (Angular decodes them
 * first), in text and in attribute values; `{ }` are reserved; `@` opens a block; and
 * `preserveWhitespaces: false` drops text made only of Angular's whitespace and condenses runs
 * of it, inside interpolations too. A lone space becomes `&ngsp;` (one space Angular keeps);
 * text it would rewrite becomes an interpolated string literal with every such space escaped.
 * `preserveWhitespaces: false` is Angular's default, which the Angular target pins in every
 * component's metadata.
 *
 * An attribute value holding `{{` has no static spelling, and a binding to it would go through
 * Angular's security checks: a URL its sanitizer rejects gets an `unsafe:` prefix, a resource
 * URL (`iframe src`, `object data`) fails with NG0904, and a bound `sandbox` or `allow` removes
 * the `iframe`. So
 * such an element is printed in `<ng-container ngNonBindable ngPreserveWhitespaces>`: the
 * container renders no element (only Angular's comment anchor), `ngNonBindable` makes its
 * descendants' attributes and text static (not its own, hence the container), and
 * `ngPreserveWhitespaces` keeps their whitespace as written, since interpolated literals no
 * longer protect it there.
 */
export const angularDialect: MarkupDialect = {
  name: "angular",
  escapeText: (text, position) => {
    if (keepsWhitespace(position)) return escapeAngular(text);
    if (text === " ") return "&ngsp;";
    return ANGULAR_WHITESPACE_ONLY.test(text) || ANGULAR_RUN.test(text)
      ? angularInterpolation(text)
      : escapeAngular(text);
  },
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
    element.attributes.some(({ value }) => value !== true && value.includes("{{"))
      ? ANGULAR_LITERAL_REGION
      : undefined,
};

/**
 * Angular markup inside `ngNonBindable` with its whitespace preserved: Angular reads no binding
 * and changes no whitespace there, but its lexer still decodes entities and reads `{` (an ICU
 * expression) and `@` (a block), which are written as references.
 */
const angularLiteralDialect: MarkupDialect = {
  name: "angular-literal",
  escapeText: (text) => escapeBraces(escapeHtmlText(text)).replace(/@/g, "&#64;"),
  attribute: (name, value) => `${name}="${escapeBraces(escapeHtmlAttribute(value))}"`,
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: false,
  stripsEdgeWhitespace: false,
};

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
 * Astro markup: `{` opens an expression in text, and Astro's default `compressHTML: "jsx"`
 * applies JSX's whitespace rules: it removes whitespace that holds a line break between or
 * around elements, and trims lines around line breaks in text. Text holding a line break or a
 * tab is printed as an expression.
 *
 * `compressHTML` is a project setting a component cannot pin. Deferred to M6 (plan §8.2): the
 * unplugin reads Astro's resolved configuration and reports any value but the default.
 */
export const astroDialect: MarkupDialect = {
  name: "astro",
  escapeText: (text, position) =>
    JSX_WHITESPACE.test(text) && !keepsWhitespace(position)
      ? `{${stringLiteral(text)}}`
      : escapeBraces(escapeHtmlText(text)),
  attribute: quotedAttribute,
  voidElement: "self-closing",
  stripsWhitespaceBetweenElements: true,
  stripsEdgeWhitespace: true,
};

function escapeBraces(text: string): string {
  return text.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

/** Angular decodes entities before it looks for `{{`, so a run of `{` is an interpolated literal. */
function escapeAngular(text: string): string {
  return escapeBraces(escapeHtmlText(text))
    .replace(
      /(?:&#123;){2,}/g,
      (run) => `{{ ${stringLiteral("{".repeat(run.length / "&#123;".length))} }}`,
    )
    .replace(/@/g, "&#64;");
}

/** Options for {@link printMarkup}. */
export interface MarkupOptions {
  /** One level of indentation. Defaults to two spaces. */
  indent?: string;
  /** The level the root starts at. */
  level?: number;
  /** The line length above which a tag with attributes puts one per line. Defaults to 100. */
  printWidth?: number;
  /** Prints attributes the target writes differently (bindings, directives). */
  attribute?(attribute: StaticAttribute, element: ElementNode): string | undefined;
}

/**
 * The printing functions of one dialect. A literal region hands its element to its own
 * dialect's printer, which goes on writing the same lines.
 */
interface Printer {
  printElement(element: ElementNode, pad: string): string[];
  writeElement(lines: string[], element: ElementNode): void;
  inlineElement(element: ElementNode): string;
}

/** What every dialect's printer of one {@link printMarkup} call shares. */
interface PrintSettings {
  indent: string;
  printWidth: number;
  options: MarkupOptions;
  /** The printer of a region's dialect. */
  printerOf: (dialect: MarkupDialect) => Printer;
}

/**
 * Prints an element as markup. A line break goes only where the whitespace it creates cannot
 * reach the DOM: between sibling elements and at the edges of an element's content where the
 * dialect's compiler drops whitespace, or inside a tag. Where the compiler keeps whitespace
 * between elements (Svelte), siblings break inside a tag (`</li\n><li>`), only next to a
 * block-level element or once their line is too long. Text is never broken and hugs its
 * neighbours, so an element whose first or last child is text keeps its content on its line.
 * A tag with attributes whose line would pass `printWidth` puts one attribute per line, inline
 * or not; text and tags without attributes are never broken, so a line holding long text still
 * passes it. An element the dialect writes in a literal region (Angular's `{{` in an attribute)
 * is printed inside it, on one line but for its tags. The layout never relies on CSS: the DOM
 * is the IR's whatever the page's styles.
 */
export function printMarkup(
  node: ElementNode,
  dialect: MarkupDialect,
  options: MarkupOptions = {},
): string {
  const printers = new Map<MarkupDialect, Printer>();
  const settings: PrintSettings = {
    indent: options.indent ?? "  ",
    printWidth: options.printWidth ?? 100,
    options,
    printerOf: (of) => {
      let printer = printers.get(of);
      if (!printer) {
        printer = createPrinter(of, settings);
        printers.set(of, printer);
      }
      return printer;
    },
  };
  return settings
    .printerOf(dialect)
    .printElement(node, settings.indent.repeat(options.level ?? 0))
    .join("\n");
}

/** The printer of one dialect, which hands an element in a literal region to that region's. */
function createPrinter(dialect: MarkupDialect, settings: PrintSettings): Printer {
  const { indent, printWidth, printerOf } = settings;
  return { printElement, writeElement, inlineElement };

  /** An element that starts a line at `pad`, with its children on its line or on their own. */
  function printElement(element: ElementNode, pad: string): string[] {
    const lines = [pad];
    const runs =
      isVoidElement(element.tag) || dialect.literalRegion?.(element)
        ? undefined
        : layout(element, pad + indent);
    if (!runs) {
      writeElement(lines, element);
      return lines;
    }
    writeOpenTag(lines, element, 0);
    const body = runs.map((run) => {
      const only = element.children[run[0]!]!;
      if (run.length === 1 && only.kind === "Element") return printElement(only, pad + indent);
      const line = [pad + indent];
      for (const index of run) writeChild(line, element, index);
      return line;
    });
    const glued = dialect.stripsWhitespaceBetweenElements ? body.flat() : body.reduce(glue);
    return [...lines, ...glued, `${pad}</${element.tag}>`];
  }

  /** Writes an element and its children from the end of the last line. */
  function writeElement(lines: string[], element: ElementNode): void {
    const region = dialect.literalRegion?.(element);
    if (region) {
      lines[lines.length - 1] += region.open;
      printerOf(region.dialect).writeElement(lines, element);
      lines[lines.length - 1] += region.close;
      return;
    }
    if (isVoidElement(element.tag)) {
      writeOpenTag(lines, element, 0);
      return;
    }
    const close = `</${element.tag}>`;
    const content = element.children.map((_, index) => inline(element, index)).join("");
    writeOpenTag(lines, element, content.length + close.length);
    element.children.forEach((_, index) => writeChild(lines, element, index));
    lines[lines.length - 1] += close;
  }

  function writeChild(lines: string[], parent: ElementNode, index: number): void {
    const child = parent.children[index]!;
    if (child.kind === "Text") lines[lines.length - 1] += text(parent, index, child.value);
    else writeElement(lines, child);
  }

  /**
   * Writes an opening tag from the end of the last line. Whitespace inside a tag is never
   * content, so a tag with attributes that would take its line past `printWidth`, with what
   * follows it on the line (`after` characters), puts one attribute per line, indented from
   * that line.
   */
  function writeOpenTag(lines: string[], element: ElementNode, after: number): void {
    const items = attributeList(element);
    const end = isVoidElement(element.tag) && dialect.voidElement === "self-closing" ? " />" : ">";
    const tag = `<${element.tag}${items.map((item) => ` ${item}`).join("")}${end}`;
    const line = lines[lines.length - 1]!;
    const column = line.length - line.lastIndexOf("\n") - 1;
    if (!items.length || column + tag.length + after <= printWidth) {
      lines[lines.length - 1] += tag;
      return;
    }
    const base = /^[\t ]*/.exec(line)![0];
    lines[lines.length - 1] += `<${element.tag}`;
    lines.push(...items.map((item) => `${base}${indent}${item}`), `${base}${end.trim()}`);
  }

  /** The child at `index` of `parent` printed on one line. */
  function inline(parent: ElementNode, index: number): string {
    const child = parent.children[index]!;
    if (child.kind === "Text") return text(parent, index, child.value);
    const region = dialect.literalRegion?.(child);
    if (!region) return inlineElement(child);
    return `${region.open}${printerOf(region.dialect).inlineElement(child)}${region.close}`;
  }

  /** An element and its children printed on one line. */
  function inlineElement(element: ElementNode): string {
    const open = `<${element.tag}${attributeList(element)
      .map((item) => ` ${item}`)
      .join("")}`;
    if (isVoidElement(element.tag)) {
      return `${open}${dialect.voidElement === "self-closing" ? " />" : ">"}`;
    }
    const content = element.children.map((_, at) => inline(element, at)).join("");
    return `${open}>${content}</${element.tag}>`;
  }

  /** The text child at `index` of `parent`, escaped for where it sits. */
  function text(parent: ElementNode, index: number, value: string): string {
    return dialect.escapeText(value, {
      parent,
      first: index === 0,
      last: index === parent.children.length - 1,
    });
  }

  function attributeList(element: ElementNode): string[] {
    return element.attributes.map((attribute) => {
      const custom = settings.options.attribute?.(attribute, element);
      if (custom !== undefined) return custom;
      return attribute.value === true
        ? attribute.name
        : dialect.attribute(attribute.name, attribute.value, element.tag);
    });
  }

  /**
   * Splits an element's children into runs of indices that may each start on a new line at
   * `pad`, or returns `undefined` when the children must stay on the element's own line.
   */
  function layout(element: ElementNode, pad: string): number[][] | undefined {
    const children = element.children;
    if (!children.length || WHITESPACE_PRESERVING_ELEMENTS.has(element.tag)) return undefined;
    if (!dialect.stripsEdgeWhitespace) return undefined;
    if (children[0]!.kind === "Text" || children.at(-1)!.kind === "Text") return undefined;
    const runs: number[][] = [[0]];
    // The width of the current run's line, for a dialect that keeps whitespace between
    // elements: there a run of inline siblings breaks only when it is too long, and inside a
    // tag (`glue`), which puts the next run's first `>` before it.
    let width = pad.length + inline(element, 0).length;
    for (let index = 1; index < children.length; index++) {
      const before = children[index - 1]!;
      const after = children[index]!;
      const between = before.kind === "Element" && after.kind === "Element";
      const next = inline(element, index).length;
      const breakable =
        between &&
        (dialect.stripsWhitespaceBetweenElements ||
          isBlockElement(before.tag) ||
          isBlockElement(after.tag) ||
          width + next > printWidth);
      if (breakable) {
        runs.push([index]);
        width = pad.length + 1 + next;
      } else {
        runs.at(-1)!.push(index);
        width += next;
      }
    }
    return runs;
  }
}

/**
 * Joins two sibling runs with no whitespace between them, for a compiler that would keep it:
 * the line breaks inside the tag that ends the first run (`</li\n  ><li>`), as whitespace inside
 * a tag is never content. A closing `/>` alone on its line takes the next run after it.
 */
function glue(lines: string[], next: string[]): string[] {
  const last = lines.at(-1)!;
  const closer = last.endsWith("/>") ? "/>" : ">";
  const before = last.slice(0, -closer.length);
  const rest = before.trimEnd();
  const [first, ...more] = next;
  const start = first!.trimStart();
  if (rest === "") return [...lines.slice(0, -1), `${before}${closer}${start}`, ...more];
  const pad = first!.slice(0, first!.length - start.length);
  return [...lines.slice(0, -1), rest, `${pad}${closer}${start}`, ...more];
}
