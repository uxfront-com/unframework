// Attribute names (plan §4.6, ADR-0017, ADR-0040): the HTML or SVG name each written name
// stands for, and the problems a name has whatever its value. The name checks run first, for
// every form of value (design §1.5), so `onClick={f}` and `key={x}` get their own diagnostics.

import type { DiagnosticCode, Fix } from "@unframework/diagnostics";
import {
  ARIA_ATTRIBUTES,
  DOCUMENT_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  isHtmlAttribute,
  isSvgAttribute,
  SVG_ELEMENT_ATTRIBUTES,
  SVG_GLOBAL_ATTRIBUTES,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  UNRENDERED_ATTRIBUTES,
} from "@unframework/ir";
import type { Namespace } from "@unframework/ir";

/** A problem with one attribute: the diagnostic to report on its name. */
export interface Problem {
  code: DiagnosticCode;
  message: string;
  help?: string;
  fixes?: Fix[];
}

/**
 * React's (and Solid's) spellings of HTML attributes whose lower case is not the HTML name, by
 * that lower case. The analyser's tables are maps: they are read with names from the source,
 * and an object would answer `constructor` or `__proto__` from its prototype.
 */
export const ALIASES: ReadonlyMap<string, string> = new Map([
  ["acceptcharset", "accept-charset"],
  ["classname", "class"],
  ["htmlfor", "for"],
  ["httpequiv", "http-equiv"],
]);

/** The events of HTML's event handler content attributes (`onclick`, `oninput`, …). */
const HTML_EVENTS: ReadonlySet<string> = new Set(
  (
    "abort afterprint animationcancel animationend animationiteration animationstart auxclick " +
    "beforeinput beforematch beforeprint beforetoggle beforeunload blur cancel canplay " +
    "canplaythrough change click close command contextlost contextmenu contextrestored copy " +
    "cuechange cut dblclick drag dragend dragenter dragleave dragover dragstart drop " +
    "durationchange emptied ended error focus focusin focusout formdata gotpointercapture " +
    "hashchange input invalid keydown keypress keyup languagechange load loadeddata " +
    "loadedmetadata loadstart lostpointercapture message messageerror mousedown mouseenter " +
    "mouseleave mousemove mouseout mouseover mouseup offline online pagehide pagereveal pageshow " +
    "pageswap paste pause play playing pointercancel pointerdown pointerenter pointerleave " +
    "pointermove pointerout pointerover pointerup popstate progress ratechange " +
    "rejectionhandled reset resize scroll scrollend securitypolicyviolation seeked seeking " +
    "select selectionchange selectstart slotchange stalled storage submit suspend timeupdate " +
    "toggle touchcancel touchend touchmove touchstart transitioncancel transitionend " +
    "transitionrun transitionstart unhandledrejection unload volumechange waiting wheel"
  ).split(" "),
);

/**
 * Names a framework gives meaning of its own, by lower-case name: they are props, not
 * attributes, or the framework adds them itself.
 */
const FRAMEWORK_PROPS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    children:
      "`children` is a framework prop, not an attribute: React renders it as the content and Solid fails to set it. Write the content as JSX children.",
    classlist: "`classList` is Solid's prop, not an attribute. Use `class`.",
    dangerouslysetinnerhtml:
      "`dangerouslySetInnerHTML` is React's prop, not an attribute. Write the content as JSX children.",
    innertext:
      "`innerText` is a DOM property, not an attribute. Write the content as JSX children.",
    outerhtml: "`outerHTML` is a DOM property, not an attribute. Write the element as JSX.",
    suppresscontenteditablewarning:
      "`suppressContentEditableWarning` is React's prop, not an attribute.",
    suppresshydrationwarning: "`suppressHydrationWarning` is React's prop, not an attribute.",
    textcontent:
      "`textContent` is a DOM property, not an attribute. Write the content as JSX children.",
  }),
);

/** What brings an attribute the targets cannot render alike yet, as its diagnostic's help. */
const LATER: ReadonlyMap<string, string> = new Map([
  ["autofocus", "Focus lands with template refs."],
  ["is", "Custom elements are not supported yet."],
  ["slot", "Slots land with composition."],
]);

/** The SVG attribute names a case-insensitive spelling stands for, on an element. */
function svgNames(tag: string): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const name of [...SVG_GLOBAL_ATTRIBUTES, ...(SVG_ELEMENT_ATTRIBUTES.get(tag) ?? [])]) {
    names.set(name.toLowerCase(), name);
  }
  return names;
}

/**
 * The name an attribute stands for. On an HTML element: lower case, with React's aliases and
 * `ariaX` resolved. On an SVG element, names keep SVG's case (`viewBox`): a spelling in another
 * case, React's camel case (`strokeWidth`) and `xlink:href` stand for SVG's name; ARIA's,
 * `data-*` and the aliases read as on HTML.
 */
export function canonicalName(tag: string, namespace: Namespace, authored: string): string {
  if (namespace === "svg") {
    if (isSvgAttribute(tag, authored)) return authored;
    if (authored === "xlink:href" || authored === "xlinkHref") return "href";
    const kebab = authored.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (kebab !== authored && isSvgAttribute(tag, kebab)) return kebab;
    const svg = svgNames(tag).get(authored.toLowerCase());
    if (svg) return svg;
  }
  if (authored === "xlink:href") return "href";
  const lower = authored.toLowerCase();
  const alias = ALIASES.get(lower);
  if (alias) return alias;
  if (/^aria[a-z]/.test(lower) && ARIA_ATTRIBUTES.has(`aria-${lower.slice(4)}`)) {
    return `aria-${lower.slice(4)}`;
  }
  return lower;
}

/** Whether a name is an attribute of an element in its namespace. */
export function isAttributeOf(tag: string, namespace: Namespace, name: string): boolean {
  return namespace === "svg" ? isSvgAttribute(tag, name) : isHtmlAttribute(tag, name);
}

/**
 * Problems a name has whatever its value: constructs that land later (events, `ref`,
 * `v-model`), framework syntax, what the targets render differently, names that are not the
 * element's attributes, and `srcdoc`, whose value is a document. Names compare in lower case,
 * as HTML's do, so `ONCLICK` is caught too. `bound` words the event's message for a binding.
 */
export function nameProblem(
  tag: string,
  namespace: Namespace,
  authored: string,
  name: string,
  bound: boolean,
): Problem | undefined {
  const lower = name.toLowerCase();
  if (lower === "ref") return unsupported(`The \`${authored}\` attribute is not supported yet.`);
  if (lower.startsWith("v-")) {
    return unsupported(`The \`${authored}\` directive is not supported yet.`);
  }
  if (lower.startsWith("on") && (/^on[A-Z]/.test(authored) || HTML_EVENTS.has(lower.slice(2)))) {
    return unsupported(
      bound
        ? `Event handlers such as \`${authored}\` are not supported yet: events land in M2.`
        : `Static event attributes such as \`${authored}\` are not supported yet; event handlers land with events.`,
    );
  }
  if (lower === "innerhtml") {
    return unsupported(`The \`${authored}\` attribute is not supported yet.`);
  }
  if (/^default(value|checked|selected)$/.test(lower)) {
    return unsupported(
      `\`${authored}\` is React's name for a form control's initial state; form state is not supported yet, and lands with \`v-model\`.`,
    );
  }
  if (lower === "defaultmuted") {
    return unsupported(
      `\`${authored}\` is the DOM property of the \`muted\` attribute. ${MUTED_REASON}`,
    );
  }
  // `xlink:href` is `href`, written the old way (UF3004 below).
  if (lower === "xmlns" || (/^(xmlns|xml|xlink):/.test(authored) && authored !== "xlink:href")) {
    return {
      code: "UF3005",
      message: `\`${authored}\` is XML's: every target writes SVG's namespace itself, and the HTML parser and the clients disagree about namespaced attributes.`,
      help: "Remove it.",
    };
  }
  // What the targets render differently (`@unframework/ir`'s portability facts), which
  // `checkInvariants` also rejects in a plugin's IR.
  const unrendered = UNRENDERED_ATTRIBUTES.get(name);
  if (unrendered) {
    return unsupported(`\`${authored}\` is not supported yet: ${unrendered}`, LATER.get(name));
  }
  const syntax = TEMPLATE_SYNTAX_ATTRIBUTES.get(name);
  if (syntax) return { code: "UF3005", message: syntax, help: LATER.get(name) };
  const reserved = reservedProblem(authored, lower);
  if (reserved) return { code: "UF3005", message: reserved };
  // HTML has no `value` on these: their value is their content, or their selected options'.
  if (
    namespace === "html" &&
    name === "value" &&
    (tag === "output" || tag === "select" || tag === "textarea")
  ) {
    return formState(tag, name);
  }
  if (!isAttributeOf(tag, namespace, name)) return unknownProblem(tag, namespace, authored, name);
  if (DOCUMENT_ATTRIBUTES.has(name)) {
    return {
      code: "UF3008",
      message: `\`${name}\` holds an HTML document, scripts included, which the compiler cannot analyse.`,
      help: "Load the document from a URL with `src`, or write its markup in the component.",
    };
  }
  return undefined;
}

/** Why a name belongs to a framework, or `undefined`. */
function reservedProblem(authored: string, name: string): string | undefined {
  const prop = FRAMEWORK_PROPS.get(name);
  if (prop) return prop;
  if (/^(bind|bindon|on|ref|let)-/.test(name)) {
    return `Angular reads \`${authored}\` as template syntax (a binding, a listener or a reference), not as an attribute.`;
  }
  if (name === "i18n" || name.startsWith("i18n-")) {
    return `Angular's compiler consumes \`${authored}\` for translations, so it never reaches the DOM.`;
  }
  if (/^_?ng/.test(name)) {
    return `Angular reserves \`${authored}\`: names starting with \`ng\` are its directives and its own attributes.`;
  }
  if (name === "nonce") {
    return "`nonce` authorises scripts and styles under a Content Security Policy, which components do not render, and browsers hide its value from the DOM.";
  }
  if (name === "data-hk")
    return "`data-hk` is the hydration key Solid adds to server-rendered elements.";
  for (const [prefix, owner] of [
    ["data-astro-", "Astro adds `data-astro-*` attributes for its scoped styles and tools."],
    ["data-qwik-", "Qwik adds `data-qwik-*` attributes itself."],
    ["data-v-", "Vue's scoped styles use `data-v-*` attributes."],
    ["data-uf-", "the compiler's own scope attributes are `data-uf-*`."],
  ] as const) {
    if (name.startsWith(prefix)) return `\`${authored}\` is reserved: ${owner}`;
  }
  return undefined;
}

/** The problem with a name that is not an attribute of the element. */
function unknownProblem(
  tag: string,
  namespace: Namespace,
  authored: string,
  name: string,
): Problem {
  if (name.startsWith("aria-")) {
    return { code: "UF3006", message: `\`${authored}\` is not an ARIA attribute.` };
  }
  if (name.startsWith("data-")) {
    return {
      code: "UF3006",
      message: `\`${authored}\` is not a valid \`data-*\` attribute name.`,
      help: "A data attribute is `data-` followed by letters, digits, `-`, `_` or `.`.",
    };
  }
  if (namespace === "svg") {
    const owners = [...SVG_ELEMENT_ATTRIBUTES]
      .filter(([, attributes]) => attributes.has(name))
      .map(([element]) => element);
    return {
      code: "UF3006",
      message: `\`${authored}\` is not an attribute of the SVG <${tag}>.`,
      help: owners.length
        ? `\`${name}\` is an attribute of ${list(owners.map((owner) => `<${owner}>`))}.`
        : "Use one of the element's SVG attributes, in SVG's own case, or a `data-*` attribute for your own data.",
    };
  }
  const owners = [...ELEMENT_ATTRIBUTES]
    .filter(([, attributes]) => attributes.has(name))
    .map(([element]) => element);
  return {
    code: "UF3006",
    message: `\`${authored}\` is not an attribute of <${tag}>.`,
    help: owners.length
      ? `\`${name}\` is an attribute of ${list(owners.map((owner) => `<${owner}>`))}.`
      : "Use one of the element's HTML attributes, or a `data-*` attribute for your own data.",
  };
}

export function formState(tag: string, name: string): Problem {
  return unsupported(
    `Form state (\`${name}\` on <${tag}>) is not supported yet: the targets set it as a DOM property or as an attribute, so they render it differently. It lands with \`v-model\`.`,
  );
}

/**
 * Why a media element's `muted` is not supported: it is no form state, so `v-model` will not
 * bring it; it needs each target to render the attribute, which none of them can be told yet.
 */
export const MUTED_REASON =
  "React and Vue set `muted` as the media element's property, so the server's markup has the attribute and the client's DOM does not.";

export function unsupported(message: string, help?: string): Problem {
  return { code: "UF1002", message, ...(help ? { help } : {}) };
}

/** `a`, `a and b`, `a, b and c` (or `or`, for alternatives). */
export function list(items: readonly string[], conjunction: "and" | "or" = "and"): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

const words = (text: string): ReadonlySet<string> => new Set(text.trim().split(/\s+/));

/**
 * The HTML attributes the authoring types (the vendored `@vue/runtime-dom` JSX types) declare
 * as a string or string literals only, on every element: a number bound to one is a type error
 * in the source, and on the React, Solid and Qwik outputs (L4), so the analyser rejects it
 * (UF3018). The conformance tests read the vendored types to keep this true.
 */
export const STRING_GLOBAL_ATTRIBUTES: ReadonlySet<string> = words(`
  about accesskey autocapitalize autocorrect autosave color contextmenu datatype dir
  enterkeyhint exportparts id inputmode is itemid itemprop itemref itemtype lang part
  placeholder prefix property radiogroup resource role security title translate typeof
  unselectable vocab
`);

/** As `STRING_GLOBAL_ATTRIBUTES`, each element's own (React's aliases resolved). */
export const STRING_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries({
    a: "href hreflang media ping referrerpolicy rel target type",
    area: "alt coords href hreflang media referrerpolicy rel shape target",
    audio: "controlslist crossorigin mediagroup preload src",
    base: "href target",
    blockquote: "cite",
    button: "form formaction formenctype formmethod formtarget name type",
    del: "cite datetime",
    details: "name",
    embed: "src type",
    fieldset: "form name",
    form: "accept-charset action autocomplete enctype method name target",
    html: "manifest",
    iframe: "allow loading name referrerpolicy sandbox scrolling src srcdoc",
    img: "alt crossorigin decoding fetchpriority loading referrerpolicy sizes src srcset usemap",
    input:
      "accept alt crossorigin form formaction formenctype formmethod formtarget list name pattern src",
    ins: "cite datetime",
    keygen: "challenge form keyparams keytype name",
    label: "for form",
    link: "as charset crossorigin href hreflang integrity media referrerpolicy rel sizes type",
    map: "name",
    menu: "type",
    meta: "charset content http-equiv name",
    meter: "form",
    object: "classid data form name type usemap wmode",
    ol: "type",
    optgroup: "label",
    option: "label",
    output: "for form name",
    param: "name",
    q: "cite",
    script: "charset crossorigin integrity nonce referrerpolicy src type",
    select: "autocomplete form name",
    source: "media sizes src srcset type",
    style: "media nonce type",
    table: "summary",
    td: "abbr align headers scope valign",
    textarea: "autocomplete dirname form name wrap",
    th: "abbr align headers scope",
    time: "datetime",
    track: "kind label src srclang",
    video: "controlslist crossorigin mediagroup poster preload src",
  }).map(([tag, names]) => [tag, words(names)]),
);

/** Whether the authoring types declare an HTML attribute of an element as a string only. */
export function isStringOnlyAttribute(tag: string, name: string): boolean {
  return STRING_GLOBAL_ATTRIBUTES.has(name) || (STRING_ATTRIBUTES.get(tag)?.has(name) ?? false);
}
