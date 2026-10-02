// The HTML vocabulary every layer shares: the analyser validates against it, the printers lay
// out by it, and the targets map attributes with it. One copy, so they cannot disagree.

import { table, words } from "./tables.ts";

/** HTML elements that never have children or a closing tag. */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/**
 * Elements whose default display is block-level (or otherwise not inline) in every browser's
 * user-agent stylesheet. Whitespace next to them does not render, so printers may break
 * lines there; whitespace between two inline elements renders as a space.
 */
export const BLOCK_ELEMENTS: ReadonlySet<string> = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "caption",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "meta",
  "nav",
  "ol",
  "optgroup",
  "option",
  "p",
  "pre",
  "script",
  "search",
  "section",
  "style",
  "summary",
  "table",
  "tbody",
  "td",
  "template",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "ul",
]);

/** Elements whose text content keeps its whitespace, so printers never reflow it. */
export const WHITESPACE_PRESERVING_ELEMENTS: ReadonlySet<string> = new Set([
  "pre",
  "textarea",
  "listing",
  "plaintext",
]);

/**
 * HTML's boolean attributes: their presence means true, whatever their value (`disabled`,
 * `disabled=""`, `disabled="disabled"`). Every other attribute written without a value in JSX
 * means the string "true", as it does in Vue's and React's JSX (`aria-hidden` → `"true"`).
 */
export const BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
  "shadowrootclonable",
  "shadowrootcustomelementregistry",
  "shadowrootdelegatesfocus",
  "shadowrootserializable",
]);

/** Whether an attribute is one of HTML's boolean attributes (names are case-insensitive). */
export function isBooleanAttribute(name: string): boolean {
  return BOOLEAN_ATTRIBUTES.has(name.toLowerCase());
}

/** Whether an element is void. */
export function isVoidElement(tag: string): boolean {
  return VOID_ELEMENTS.has(tag);
}

/** Whether an element is block-level by default. Custom elements are inline. */
export function isBlockElement(tag: string): boolean {
  return BLOCK_ELEMENTS.has(tag);
}

/**
 * The elements of the HTML Living Standard (its element index), in the HTML namespace. SVG's
 * `<svg>` and MathML's `<math>` are foreign elements and are not listed.
 */
export const HTML_ELEMENTS: ReadonlySet<string> = words(`
  a abbr address area article aside audio b base bdi bdo blockquote body br button canvas
  caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed
  fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe
  img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol
  optgroup option output p picture pre progress q rp rt ruby s samp script search section
  select selectedcontent slot small source span strong style sub summary sup table tbody td
  template textarea tfoot th thead time title tr track u ul var video wbr
`);

/** Elements HTML no longer defines (its "obsolete features"); browsers still parse some specially. */
export const OBSOLETE_ELEMENTS: ReadonlySet<string> = words(`
  acronym applet basefont bgsound big blink center dir font frame frameset image isindex keygen
  listing marquee menuitem multicol nextid nobr noembed noframes param plaintext rb rtc spacer
  strike tt xmp
`);

/** The heading elements. */
export const HEADING_ELEMENTS: ReadonlySet<string> = words("h1 h2 h3 h4 h5 h6");

/** Start tags that make the HTML parser close an open `<p>` (the "in body" insertion mode). */
export const P_CLOSING_ELEMENTS: ReadonlySet<string> = words(`
  address article aside blockquote center dd details dialog dir div dl dt fieldset figcaption
  figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li listing main menu nav ol p plaintext
  pre search section summary table ul xmp
`);

/**
 * Nesting the HTML parser repairs: one of `descendants` anywhere inside the ancestor (unless a
 * `resetBy` element comes between them) makes the parser close the ancestor (`p`, `li`, `dd`,
 * `dt`, headings, `a`, `button`) or drop the inner start tag (`form`). Server-rendered HTML then
 * builds a different tree from the one a client renderer builds with `createElement`. These
 * are the union of the parser's rules and the checks of Svelte's compiler (an error), Vue's
 * compiler (a warning) and React (a console error), and valid HTML never contains them.
 */
export const REPAIRED_DESCENDANTS: ReadonlyMap<
  string,
  { descendants: ReadonlySet<string>; resetBy?: ReadonlySet<string> }
> = table({
  p: { descendants: P_CLOSING_ELEMENTS },
  a: { descendants: words("a") },
  button: { descendants: words("button") },
  form: { descendants: words("form") },
  li: { descendants: words("li"), resetBy: words("ol ul menu") },
  dd: { descendants: words("dd dt"), resetBy: words("dl") },
  dt: { descendants: words("dd dt"), resetBy: words("dl") },
  ...Object.fromEntries(
    [...HEADING_ELEMENTS].map((tag) => [tag, { descendants: HEADING_ELEMENTS }]),
  ),
});

/**
 * The only element children the HTML parser keeps in place inside these elements: anything else
 * is moved before the table ("foster parenting"), wrapped in an implied element (`<tbody>`,
 * `<tr>`, `<colgroup>`) or dropped. Vue's compiler and React check the same lists.
 */
export const PERMITTED_CHILDREN: ReadonlyMap<string, ReadonlySet<string>> = table({
  table: words("caption colgroup thead tbody tfoot script style template"),
  thead: words("tr script style template"),
  tbody: words("tr script style template"),
  tfoot: words("tr script style template"),
  tr: words("td th script style template"),
  colgroup: words("col template"),
  select: words("option optgroup hr script template"),
  optgroup: words("option script template"),
});

/**
 * Elements that belong only inside certain parents. Outside a table, the parser ignores the
 * start tags of table parts; Vue's compiler warns about the others, except `rt` and `rp`,
 * which React reports under `<p>`, `<li>` and the other elements with implied end tags.
 */
export const REQUIRED_PARENTS: ReadonlyMap<string, ReadonlySet<string>> = table({
  caption: words("table"),
  colgroup: words("table"),
  thead: words("table"),
  tbody: words("table"),
  tfoot: words("table"),
  tr: words("thead tbody tfoot"),
  td: words("tr"),
  th: words("tr"),
  col: words("colgroup"),
  dd: words("dl div"),
  dt: words("dl div"),
  figcaption: words("figure"),
  summary: words("details"),
  area: words("map"),
  rp: words("ruby"),
  rt: words("ruby"),
});

/**
 * HTML elements a component cannot render, and why: the document's own elements, code the
 * compiler cannot analyse, and elements that are template syntax in some target. The analyser
 * reports them (UF3002), and no IR holds one.
 */
export const UNRENDERABLE_ELEMENTS: ReadonlyMap<string, string> = table({
  html: "<html> is the document's root: the browser drops it inside the page.",
  head: "<head> belongs to the document: the browser drops it inside the page.",
  body: "<body> belongs to the document: the browser drops it inside the page.",
  base: "<base> describes the document, so a component cannot render it.",
  link: "<link> describes the document: React moves it into the <head>, and the other frameworks leave it in place.",
  meta: "<meta> describes the document: React moves it into the <head>, and the other frameworks leave it in place.",
  title:
    "<title> names the document: React moves it into the <head>, and the other frameworks leave it in place.",
  script:
    "<script> holds code the compiler cannot analyse, and Vue and Angular drop it from templates.",
  style:
    "<style> is not supported: Vue and Angular drop it from templates. A component's styles are a stylesheet it imports.",
  noscript:
    "<noscript> renders differently with scripting on and off, so the server and the browser disagree.",
  template: "<template> is template syntax in Vue and Astro, and its content is not rendered.",
  slot: "<slot> is template syntax in Vue, Svelte and Astro. Slots land with composition.",
});

/** Elements whose content is text only: the parser reads markup inside them as text. */
export const TEXT_ONLY_ELEMENTS: ReadonlySet<string> = words(
  "iframe option script style textarea title",
);

/**
 * Elements that hold no text, not even whitespace: the parser moves text out of a table, and
 * React reports whitespace there as a hydration error.
 */
export const TEXTLESS_ELEMENTS: ReadonlySet<string> = words(
  "colgroup frameset head html table tbody tfoot thead tr",
);

/** HTML's global attributes, which every HTML element accepts, and ARIA's `role`. */
export const GLOBAL_ATTRIBUTES: ReadonlySet<string> = words(`
  accesskey autocapitalize autocorrect autofocus class contenteditable dir draggable
  enterkeyhint hidden id inert inputmode is itemid itemprop itemref itemscope itemtype lang
  nonce popover role slot spellcheck style tabindex title translate writingsuggestions
`);

/**
 * Each element's own attributes (HTML's attribute index), besides the global ones, and the
 * `capture` of HTML Media Capture on `<input>`, which React and the authoring types know.
 */
export const ELEMENT_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = table({
  a: words("download href hreflang ping referrerpolicy rel target type"),
  area: words("alt coords download href ping referrerpolicy rel shape target"),
  audio: words("autoplay controls crossorigin loop muted preload src"),
  base: words("href target"),
  blockquote: words("cite"),
  button: words(`
    command commandfor disabled form formaction formenctype formmethod formnovalidate
    formtarget name popovertarget popovertargetaction type value
  `),
  canvas: words("height width"),
  col: words("span"),
  colgroup: words("span"),
  data: words("value"),
  del: words("cite datetime"),
  details: words("name open"),
  dialog: words("closedby open"),
  embed: words("height src type width"),
  fieldset: words("disabled form name"),
  form: words("accept-charset action autocomplete enctype method name novalidate rel target"),
  iframe: words(
    "allow allowfullscreen height loading name referrerpolicy sandbox src srcdoc width",
  ),
  img: words(`
    alt crossorigin decoding fetchpriority height ismap loading referrerpolicy sizes src
    srcset usemap width
  `),
  input: words(`
    accept alt autocomplete capture checked dirname disabled form formaction formenctype
    formmethod formnovalidate formtarget height list max maxlength min minlength multiple name
    pattern placeholder popovertarget popovertargetaction readonly required size src step type
    value width
  `),
  ins: words("cite datetime"),
  label: words("for"),
  li: words("value"),
  link: words(`
    as blocking color crossorigin disabled fetchpriority href hreflang imagesizes imagesrcset
    integrity media referrerpolicy rel sizes type
  `),
  map: words("name"),
  meta: words("charset content http-equiv media name"),
  meter: words("high low max min optimum value"),
  object: words("data form height name type width"),
  ol: words("reversed start type"),
  optgroup: words("disabled label"),
  option: words("disabled label selected value"),
  output: words("for form name"),
  progress: words("max value"),
  q: words("cite"),
  script: words(`
    async blocking crossorigin defer fetchpriority integrity nomodule referrerpolicy src type
  `),
  select: words("autocomplete disabled form multiple name required size"),
  slot: words("name"),
  source: words("height media sizes src srcset type width"),
  style: words("blocking media"),
  td: words("colspan headers rowspan"),
  template: words(`
    shadowrootclonable shadowrootcustomelementregistry shadowrootdelegatesfocus shadowrootmode
    shadowrootserializable
  `),
  textarea: words(`
    autocomplete cols dirname disabled form maxlength minlength name placeholder readonly
    required rows wrap
  `),
  th: words("abbr colspan headers rowspan scope"),
  time: words("datetime"),
  track: words("default kind label src srclang"),
  video: words(`
    autoplay controls crossorigin height loop muted playsinline poster preload src width
  `),
});

/**
 * WAI-ARIA 1.2's states and properties, without the deprecated ones, and the 1.3 additions
 * axe-core knows (`aria-braillelabel`, `aria-brailleroledescription`, `aria-description`).
 * 1.3's `aria-colindextext` and `aria-rowindextext` wait for axe-core 4.13, which reports them
 * as invalid (L11).
 */
export const ARIA_ATTRIBUTES: ReadonlySet<string> = words(`
  aria-activedescendant aria-atomic aria-autocomplete aria-braillelabel
  aria-brailleroledescription aria-busy aria-checked aria-colcount aria-colindex aria-colspan
  aria-controls aria-current aria-describedby aria-description aria-details aria-disabled
  aria-errormessage aria-expanded aria-flowto aria-haspopup aria-hidden aria-invalid
  aria-keyshortcuts aria-label aria-labelledby aria-level aria-live aria-modal aria-multiline
  aria-multiselectable aria-orientation aria-owns aria-placeholder aria-posinset aria-pressed
  aria-readonly aria-relevant aria-required aria-roledescription aria-rowcount aria-rowindex
  aria-rowspan aria-selected aria-setsize aria-sort aria-valuemax aria-valuemin aria-valuenow
  aria-valuetext
`);

/**
 * Attributes (besides `data-*`) whose values include the keyword `true`. JSX gives an attribute
 * written without a value the value `true`, which for these means what HTML means.
 */
export const TRUE_VALUED_ATTRIBUTES: ReadonlySet<string> = words(`
  contenteditable draggable spellcheck writingsuggestions aria-atomic aria-busy aria-checked
  aria-current aria-disabled aria-expanded aria-haspopup aria-hidden aria-invalid aria-modal
  aria-multiline aria-multiselectable aria-pressed aria-readonly aria-required aria-selected
`);

/** Attributes whose value is a URL. */
export const URL_ATTRIBUTES: ReadonlySet<string> = words(
  "action cite data formaction href poster src",
);

/**
 * A URL's scheme as browsers read it, in lower case, or `undefined` for a URL without one (a
 * relative URL): the URL parser strips leading C0 controls and spaces, and removes tabs and
 * line breaks anywhere, before it reads the scheme.
 */
function urlScheme(url: string): string | undefined {
  // oxlint-disable-next-line no-control-regex -- the leading C0 controls the URL parser strips.
  const stripped = url.replace(/^[\u0000-\u001F ]+/, "").replace(/[\t\n\r]/g, "");
  return /^([a-z][a-z\d+.-]*):/i.exec(stripped)?.[1]?.toLowerCase();
}

/**
 * Whether a URL runs code: a `javascript:` URL, read as browsers read the scheme, which is
 * also React's test. React replaces one with a URL that throws; the other targets render it as
 * written.
 */
export function isJavaScriptUrl(url: string): boolean {
  return urlScheme(url) === "javascript";
}

/**
 * Attributes whose value is an HTML document: an iframe renders its `srcdoc`, scripts included,
 * as the page's own origin unless sandboxed. The compiler cannot analyse a document, so it
 * never copies one into an output.
 */
export const DOCUMENT_ATTRIBUTES: ReadonlySet<string> = words("srcdoc");

/**
 * The attribute that loads a document into a nested browsing context when the element renders,
 * by element: HTML's frames, objects and embeds. (A link or a form loads one only when the user
 * follows it.)
 */
export const NESTED_DOCUMENT_ATTRIBUTES: ReadonlyMap<string, string> = table({
  embed: "src",
  iframe: "src",
  object: "data",
});

/**
 * The scheme of a URL attribute's value whose code or document the compiler would copy into
 * every output without analysing it, or `undefined`:
 * - `javascript`: a `javascript:` URL, in any URL attribute, runs as the page's code;
 * - `data`: a `data:` URL holds a document, scripts included, wherever an element loads it into
 *   a nested browsing context as it renders (`NESTED_DOCUMENT_ATTRIBUTES`). Elsewhere it is an
 *   image or a media file, or the destination of a link or a form, which loads only when the
 *   user follows it, in an origin of its own (browsers refuse to open one as the page).
 *
 * A `blob:` or `filesystem:` URL holds nothing the compiler could analyse: it names content the
 * page creates at run time, outside the source, so it is a URL like any other.
 */
export function unanalysableUrl(
  tag: string,
  name: string,
  value: string,
): "javascript" | "data" | undefined {
  if (!URL_ATTRIBUTES.has(name)) return undefined;
  if (isJavaScriptUrl(value)) return "javascript";
  if (NESTED_DOCUMENT_ATTRIBUTES.get(tag) === name && urlScheme(value) === "data") return "data";
  return undefined;
}

/**
 * Attributes whose value is an element's id, or a space-separated list of ids: the element's
 * own `id`, and every attribute that points at an element by id, including the ones the
 * analyser does not accept yet. The analyser reserves the generated-id prefix in all of them,
 * and the tests' normaliser renames generated ids in all of them, from this one list.
 */
export const ID_REFERENCE_ATTRIBUTES: ReadonlySet<string> = words(`
  id for form headers itemref list popovertarget commandfor interestfor
  aria-activedescendant aria-actions aria-controls aria-describedby aria-details
  aria-errormessage aria-flowto aria-labelledby aria-owns
`);

/**
 * The prefix of the ids the compiler generates (`useId`, M2), on every target: the tests
 * recognise generated ids by it alone, and the analyser rejects authored ids that start with it.
 */
export const GENERATED_ID_PREFIX = "uf-id-";

/** Attributes that point at an element by a `#id` value: the URLs, SVG's `xlink:href`, `usemap`. */
const FRAGMENT_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...URL_ATTRIBUTES,
  "usemap",
  "xlink:href",
]);

/** `url(#id)`, in any value: SVG's paint and clip references, in attributes and in `style`. */
const URL_REFERENCE = /url\(\s*(["']?)#([^"')\s]+)\1\s*\)/gi;

/**
 * Replaces each id an attribute value refers to with `replace(id)`: every id of an
 * `ID_REFERENCE_ATTRIBUTES` value, the fragment of a `#id` URL, and the id of each `url(#id)` in
 * any other value. The analyser and the tests' normaliser both read references this way, so an
 * id one of them sees, the other does too.
 */
export function replaceIdReferences(
  name: string,
  value: string,
  replace: (id: string) => string,
): string {
  if (ID_REFERENCE_ATTRIBUTES.has(name)) {
    return value.replace(/[^\t\n\f\r ]+/g, (id) => replace(id));
  }
  if (FRAGMENT_ATTRIBUTES.has(name) && value.length > 1 && value.startsWith("#")) {
    return `#${replace(value.slice(1))}`;
  }
  return value.replace(
    URL_REFERENCE,
    (_reference, quote: string, id: string) => `url(${quote}#${replace(id)}${quote})`,
  );
}

/** The ids an attribute value refers to, in order (see {@link replaceIdReferences}). */
export function idReferencesIn(name: string, value: string): string[] {
  const ids: string[] = [];
  replaceIdReferences(name, value, (id) => {
    ids.push(id);
    return id;
  });
  return ids;
}

/** Why HTML does not keep a character of text or an attribute value as written. */
export type UnkeptCharacter = "carriage-return" | "nul" | "surrogate" | "control" | "noncharacter";

/**
 * Whether HTML keeps a character as written, and why not: the parser reads a carriage return
 * (and CRLF) as a line feed, drops NUL from text and replaces it in attribute values; UTF-8
 * cannot encode a lone surrogate, so server markup holds U+FFFD; and HTML does not allow the
 * controls (but tab, line feed and form feed) or the noncharacters in a document.
 */
export function unkeptCharacter(codePoint: number): UnkeptCharacter | undefined {
  if (codePoint === 0x0d) return "carriage-return";
  if (codePoint === 0) return "nul";
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return "surrogate";
  if (
    (codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0c) ||
    (codePoint >= 0x7f && codePoint <= 0x9f)
  ) {
    return "control";
  }
  if ((codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe) {
    return "noncharacter";
  }
  return undefined;
}

/** The kinds of number HTML's numeric attributes take. */
export type NumberKind = "integer" | "non-negative-integer" | "positive-integer" | "number";

/**
 * Numeric attributes whose DOM property has the same name, by element. Setting the property,
 * as some renderers do for static attributes, writes the number back in canonical form
 * (`"03"` becomes `"3"`, `"0.50"` becomes `"0.5"`) or fails on a value that is not a number.
 * `rowspan` is listed because renderers parse it as a number too.
 */
export const NUMERIC_ATTRIBUTES: ReadonlyMap<
  string,
  ReadonlyMap<string, { kind: NumberKind; max?: number }>
> = new Map(
  Object.entries<Readonly<Record<string, { kind: NumberKind; max?: number }>>>({
    col: { span: { kind: "positive-integer", max: 1000 } },
    colgroup: { span: { kind: "positive-integer", max: 1000 } },
    input: {
      height: { kind: "non-negative-integer" },
      size: { kind: "positive-integer" },
      width: { kind: "non-negative-integer" },
    },
    li: { value: { kind: "integer" } },
    meter: {
      high: { kind: "number" },
      low: { kind: "number" },
      max: { kind: "number" },
      min: { kind: "number" },
      optimum: { kind: "number" },
      value: { kind: "number" },
    },
    ol: { start: { kind: "integer" } },
    progress: { max: { kind: "number" }, value: { kind: "number" } },
    select: { size: { kind: "positive-integer" } },
    td: { rowspan: { kind: "non-negative-integer", max: 65534 } },
    textarea: { cols: { kind: "positive-integer" }, rows: { kind: "positive-integer" } },
    th: { rowspan: { kind: "non-negative-integer", max: 65534 } },
  }).map(([tag, attributes]) => [tag, table(attributes)]),
);

/** HTML's syntax for each kind of number. */
const NUMBER_SYNTAX: Readonly<Record<NumberKind, RegExp>> = {
  integer: /^-?\d+$/,
  "non-negative-integer": /^\d+$/,
  "positive-integer": /^\d+$/,
  number: /^-?(\d+|\d*\.\d+)(e[+-]?\d+)?$/i,
};

/**
 * A numeric attribute's value as the renderers that set its DOM property write it back
 * (`"03"` → `"3"`), or `undefined` when it is not a number of its kind in range, which they
 * reject or replace. Only a value that is its own canonical form renders alike everywhere.
 */
export function canonicalNumber(
  value: string,
  { kind, max }: { kind: NumberKind; max?: number },
): string | undefined {
  const number = Number(value);
  const limit = max ?? 2 ** 31 - 1;
  const min = kind === "integer" ? -(2 ** 31) : kind === "positive-integer" ? 1 : 0;
  const inRange =
    Number.isFinite(number) && (kind === "number" || (number <= limit && number >= min));
  return NUMBER_SYNTAX[kind].test(value) && inRange ? String(number) : undefined;
}

/** Whether a tag is an element of the HTML Living Standard. */
export function isHtmlElement(tag: string): boolean {
  return HTML_ELEMENTS.has(tag);
}

/** Whether an attribute (in lower case) is an HTML attribute of the element. */
export function isHtmlAttribute(tag: string, name: string): boolean {
  return (
    GLOBAL_ATTRIBUTES.has(name) ||
    (ELEMENT_ATTRIBUTES.get(tag)?.has(name) ?? false) ||
    ARIA_ATTRIBUTES.has(name) ||
    isDataAttribute(name)
  );
}

/** Whether a name is a custom data attribute: `data-` and at least one more name character. */
export function isDataAttribute(name: string): boolean {
  return /^data-[\p{Ll}\p{Lo}\p{N}_.-]+$/u.test(name);
}
