import type { DiagnosticCode, Fix } from "@unframework/diagnostics";
import {
  ARIA_ATTRIBUTES,
  canonicalNumber,
  CHILDLESS_ATTRIBUTES,
  createStaticAttribute,
  DOCUMENT_ATTRIBUTES,
  ELEMENT_ATTRIBUTES,
  GENERATED_ID_PREFIX,
  idReferencesIn,
  isBooleanAttribute,
  isDataAttribute,
  isDroppedEmptyUrl,
  isHtmlAttribute,
  isStateAttribute,
  NUMERIC_ATTRIBUTES,
  TEMPLATE_SYNTAX_ATTRIBUTES,
  TRUE_VALUED_ATTRIBUTES,
  unanalysableUrl,
  UNRENDERED_ATTRIBUTES,
} from "@unframework/ir";
import type { Attribute, NumberKind } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import { unportableCharacters } from "./characters.ts";
import { reportCharacter, reportDivergence, reportHtmlOnlyReference } from "./context.ts";
import type { RawSpan, Reporter } from "./context.ts";
import { htmlOnlyReferences, readJsxAttribute } from "./jsx/text.ts";
import type { HtmlOnlyReference } from "./jsx/text.ts";

/** A problem with one attribute: the diagnostic to report on its name. */
interface Problem {
  code: DiagnosticCode;
  message: string;
  help?: string;
  fixes?: Fix[];
}

/** An attribute that passed the name checks, before the checks that need its element. */
interface ReadAttribute {
  /** The HTML name, in lower case (`className` reads as `class`). */
  name: string;
  /** The name as written. */
  authored: string;
  /** The decoded value, or `null` when the attribute has none. */
  value: string | null;
  node: AST.JSXAttribute;
  /** The attribute's name, where its diagnostics point. */
  nameNode: AST.JSXIdentifier;
  /** Where the source before it ends: removing it removes from there. */
  after: number;
  /** Whether its value has a problem already reported (UF3009, UF3010). */
  reported: boolean;
  /** The references in its value that only HTML decodes, to report once its checks are known. */
  references: HtmlOnlyReference[];
}

/**
 * React's (and Solid's) spellings of HTML attributes whose lower case is not the HTML name, by
 * that lower case. The analyser's tables are maps: they are read with names from the source,
 * and an object would answer `constructor` or `__proto__` from its prototype.
 */
const ALIASES: ReadonlyMap<string, string> = new Map([
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

/**
 * Reads, validates and lowers an element's attributes. Every attribute is checked on its own
 * first (name, reserved syntax, how JSX reads its value), then against the element (form
 * state, submit-only attributes) and the others (duplicates). An attribute with a problem is
 * reported and left out; the rest are lowered with their HTML names.
 */
export function lowerAttributes(
  tag: string,
  opening: AST.JSXOpeningElement,
  hasChildren: boolean,
  reporter: Reporter,
): Attribute[] {
  const read: ReadAttribute[] = [];
  let after = opening.name.end;
  for (const item of opening.attributes) {
    const previous = after;
    after = item.end;
    if (item.type === "JSXSpreadAttribute") {
      reporter.unsupported(item, "Attribute spreads are not supported yet.");
      continue;
    }
    if (item.name.type === "JSXNamespacedName") {
      reporter.unsupported(item.name, "Namespaced attributes are not supported yet.");
      continue;
    }
    if (
      item.value !== null &&
      !(item.value.type === "Literal" && typeof item.value.value === "string")
    ) {
      reporter.unsupported(
        item.value,
        "Attribute values other than string literals are not supported yet.",
      );
      continue;
    }
    const authored = item.name.name;
    const name = canonicalName(authored);
    const problem = nameProblem(tag, authored, name);
    if (problem) {
      report(reporter, item.name, problem);
      continue;
    }
    const value = item.value === null ? null : readValue(name, item.value, reporter);
    read.push({
      name,
      authored,
      value: value?.value ?? null,
      node: item,
      nameNode: item.name,
      after: previous,
      reported: value?.reported ?? false,
      references: item.value === null ? [] : htmlOnlyReferences(item.value.value),
    });
  }

  const counts = new Map<string, number>();
  for (const attribute of read) counts.set(attribute.name, (counts.get(attribute.name) ?? 0) + 1);
  // `type` is an enumerated attribute, so its keywords are case-insensitive.
  const type = read.find((attribute) => attribute.name === "type")?.value?.toLowerCase();

  const attributes: Attribute[] = [];
  const firsts = new Map<string, ReadAttribute>();
  for (const attribute of read) {
    const first = firsts.get(attribute.name);
    if (first) {
      reporter.report(
        "UF3007",
        attribute.nameNode,
        `\`${attribute.name}\` is set twice on this <${tag}>.`,
        {
          help: "Keep one: the targets disagree about which value wins.",
          related: [{ span: span(first.nameNode), message: "First set here" }],
        },
      );
      reportReferences(attribute, false, reporter);
      continue;
    }
    firsts.set(attribute.name, attribute);
    // Messages name the attribute by its HTML name, so they read the same once a rename is
    // applied: fixing one problem never changes another's message. A fix that removes the
    // attribute leaves no name to rename, and its edits would overlap the rename's.
    const unique = counts.get(attribute.name) === 1;
    const found =
      elementProblem(tag, attribute, type, hasChildren) ?? valueProblem(tag, attribute, unique);
    const removes = found?.fixes?.some((fix) =>
      fix.edits.some(
        (edit) =>
          edit.span.start <= attribute.nameNode.start && edit.span.end >= attribute.nameNode.end,
      ),
    );
    const problems = [found, removes ? undefined : caseProblem(attribute, unique)].filter(
      (item) => item !== undefined,
    );
    for (const problem of problems) report(reporter, attribute.nameNode, problem);
    const accepted = !problems.length && !attribute.reported;
    if (attribute.references.length) {
      // Their fix is offered where the attribute is accepted, before it and after it.
      const fixed = { ...attribute, value: referencesFixed(attribute) };
      reportReferences(attribute, accepted && !valueProblem(tag, fixed, unique), reporter);
    }
    if (!accepted) continue;
    attributes.push(
      createStaticAttribute(attribute.name, loweredValue(attribute), span(attribute.node)),
    );
  }
  return attributes;
}

/**
 * An attribute not written with its HTML name. The rename is offered only when it cannot
 * create a duplicate (`className` beside `class`).
 */
function caseProblem(attribute: ReadAttribute, unique: boolean): Problem | undefined {
  const { name, authored, nameNode } = attribute;
  if (authored === name) return undefined;
  return {
    code: "UF3004",
    message: `\`${authored}\` is written \`${name}\`: elements take HTML's attribute names, in lower case.`,
    fixes: unique
      ? [
          {
            title: `Rename \`${authored}\` to \`${name}\``,
            confidence: "safe",
            edits: [{ span: span(nameNode), text: name }],
          },
        ]
      : [],
  };
}

/** The HTML name of an attribute: lower case, with React's aliases and `ariaX` resolved. */
function canonicalName(authored: string): string {
  const lower = authored.toLowerCase();
  const alias = ALIASES.get(lower);
  if (alias) return alias;
  if (/^aria[a-z]/.test(lower) && ARIA_ATTRIBUTES.has(`aria-${lower.slice(4)}`)) {
    return `aria-${lower.slice(4)}`;
  }
  return lower;
}

/**
 * Reads an attribute string and reports what in it the targets cannot render alike: what JSX
 * implementations decode differently (UF3009), and characters HTML would not keep (UF3010).
 * The ASCII whitespace of a `class` separates its names, so none of it is rendered.
 */
function readValue(
  name: string,
  literal: AST.StringLiteral,
  reporter: Reporter,
): { value: string; reported: boolean } {
  const raw = literal.value;
  const reading = readJsxAttribute(raw);
  // The raw text starts after the opening quote.
  const at: RawSpan = (range) => ({
    start: literal.start + 1 + range.start,
    end: literal.start + 1 + range.end,
  });
  for (const divergence of reading.divergences) reportDivergence(divergence, at, reporter);
  const rendered =
    name === "class"
      ? reading.kept.filter((piece) => !ASCII_WHITESPACE.test(piece.value))
      : reading.kept;
  const characters = unportableCharacters(raw, rendered, reading.divergences);
  for (const character of characters) reportCharacter(character, at, reporter);
  return {
    value: reading.value,
    reported: reading.divergences.length > 0 || characters.length > 0,
  };
}

/** Where an attribute string's raw text lies in the source: after the opening quote. */
function rawSpan(attribute: ReadAttribute): RawSpan {
  const start = attribute.node.value!.start + 1;
  return (range) => ({ start: start + range.start, end: start + range.end });
}

/** Reports the references only HTML decodes in an attribute's value (UF3011). */
function reportReferences(attribute: ReadAttribute, fixable: boolean, reporter: Reporter): void {
  if (!attribute.references.length) return;
  const at = rawSpan(attribute);
  for (const reference of attribute.references) {
    reportHtmlOnlyReference(reference, at, fixable, reporter);
  }
}

/** An attribute's value with every reference only HTML decodes written as a numeric one. */
function referencesFixed(attribute: ReadAttribute): string {
  let raw = (attribute.node.value as AST.StringLiteral).value;
  for (const reference of attribute.references.toReversed()) {
    raw = raw.slice(0, reference.start) + reference.numeric + raw.slice(reference.end);
  }
  return readJsxAttribute(raw).value;
}

/** HTML's ASCII whitespace: what separates the names in a `class`. */
const ASCII_WHITESPACE = /^[\t\n\f\r ]+$/;

/** A `class` value's names, separated by single spaces, as Vue, Svelte and Angular render it. */
function classNames(value: string): string {
  return value
    .split(/[\t\n\f\r ]+/)
    .filter(Boolean)
    .join(" ");
}

/** The value an accepted attribute lowers to (see `StaticAttribute.value`). */
function loweredValue(attribute: ReadAttribute): string | true {
  if (attribute.value === null) return isBooleanAttribute(attribute.name) ? true : "true";
  return attribute.name === "class" ? classNames(attribute.value) : attribute.value;
}

/**
 * Problems a name has whatever its value: constructs that land later (events, `style`, `key`,
 * `v-model`), framework syntax, what the targets render differently, names that are not the
 * element's attributes, and `srcdoc`, whose value is a document. Names compare in lower case,
 * as HTML's do, so `ONCLICK` and `STYLE` are caught too.
 */
function nameProblem(tag: string, authored: string, name: string): Problem | undefined {
  if (name === "key" || name === "ref") {
    return unsupported(`The \`${authored}\` attribute is not supported yet.`);
  }
  if (name.startsWith("v-")) {
    return unsupported(`The \`${authored}\` directive is not supported yet.`);
  }
  if (name.startsWith("on") && (/^on[A-Z]/.test(authored) || HTML_EVENTS.has(name.slice(2)))) {
    return unsupported(
      `Static event attributes such as \`${authored}\` are not supported yet; event handlers land with events.`,
    );
  }
  if (name === "style") {
    return unsupported(
      `Static \`${authored}\` attributes are not supported yet; style bindings land with class and style support.`,
    );
  }
  if (name === "innerhtml") {
    return unsupported(`The \`${authored}\` attribute is not supported yet.`);
  }
  if (/^default(value|checked|selected)$/.test(name)) {
    return unsupported(
      `\`${authored}\` is React's name for a form control's initial state; form state is not supported yet, and lands with \`v-model\`.`,
    );
  }
  if (name === "defaultmuted") {
    return unsupported(
      `\`${authored}\` is the DOM property of the \`muted\` attribute. ${MUTED_REASON}`,
    );
  }
  // What the targets render differently (`@unframework/ir`'s portability facts), which
  // `checkInvariants` also rejects in a plugin's IR.
  const unrendered = UNRENDERED_ATTRIBUTES.get(name);
  if (unrendered) {
    return unsupported(`\`${authored}\` is not supported yet: ${unrendered}`, LATER.get(name));
  }
  const syntax = TEMPLATE_SYNTAX_ATTRIBUTES.get(name);
  if (syntax) return { code: "UF3005", message: syntax, help: LATER.get(name) };
  const reserved = reservedProblem(authored, name);
  if (reserved) return { code: "UF3005", message: reserved };
  // HTML has no `value` on these: their value is their content, or their selected options'.
  if (name === "value" && (tag === "output" || tag === "select" || tag === "textarea")) {
    return formState(tag, name);
  }
  // ARIA values (`aria-hidden="yes"`) and roles are not validated yet: they render alike on
  // every target, axe-core checks them (L11), and Svelte warns about them (L3). M1's
  // `aria-*` cases add the checks here.
  if (!isHtmlAttribute(tag, name)) return unknownProblem(tag, authored, name);
  if (DOCUMENT_ATTRIBUTES.has(name)) {
    return {
      code: "UF3008",
      message: `\`${name}\` holds an HTML document, scripts included, which the compiler cannot analyse.`,
      help: "Load the document from a URL with `src`, or write its markup in the component.",
    };
  }
  return undefined;
}

/** What brings an attribute the targets cannot render alike yet, as its diagnostic's help. */
const LATER: ReadonlyMap<string, string> = new Map([
  ["autofocus", "Focus lands with template refs."],
  ["is", "Custom elements are not supported yet."],
  ["slot", "Slots land with composition."],
]);

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
function unknownProblem(tag: string, authored: string, name: string): Problem {
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

function formState(tag: string, name: string): Problem {
  return unsupported(
    `Form state (\`${name}\` on <${tag}>) is not supported yet: the targets set it as a DOM property or as an attribute, so they render it differently. It lands with \`v-model\`.`,
  );
}

/**
 * Why a media element's `muted` is not supported: it is no form state, so `v-model` will not
 * bring it; it needs each target to render the attribute, which none of them can be told yet.
 */
const MUTED_REASON =
  "React and Vue set `muted` as the media element's property, so the server's markup has the attribute and the client's DOM does not.";

/** The attributes that override the form's submission, allowed only on submit buttons. */
const SUBMISSION_OVERRIDES: ReadonlySet<string> = new Set(
  "formaction formenctype formmethod formnovalidate formtarget".split(" "),
);

/**
 * Problems that depend on the element: its type, its children. State attributes and editable
 * content are what the targets render differently (`checkInvariants` rejects them too); the
 * submission overrides are valid HTML that does nothing where it is written.
 */
function elementProblem(
  tag: string,
  attribute: ReadAttribute,
  type: string | undefined,
  hasChildren: boolean,
): Problem | undefined {
  const { name } = attribute;
  if (isStateAttribute(tag, name, type)) {
    return name === "muted"
      ? unsupported(`\`muted\` on <${tag}> is not supported yet: ${MUTED_REASON}`)
      : formState(tag, name);
  }
  if (SUBMISSION_OVERRIDES.has(name)) {
    // A button's missing or invalid `type` is the Submit Button state; an input's is Text.
    const submits =
      tag === "button"
        ? type !== "button" && type !== "reset"
        : type === "submit" || type === "image";
    if (!submits) {
      return {
        code: "UF3006",
        message: `\`${name}\` only applies to a submit button, and this <${tag}> is not one.`,
        help:
          tag === "button"
            ? 'Remove it, or make the button `type="submit"`.'
            : 'Remove it, or make the input `type="submit"` or `type="image"`.',
      };
    }
  }
  const childless = CHILDLESS_ATTRIBUTES.get(name);
  if (childless && hasChildren) {
    return unsupported(
      `Editable content (\`${name}\` with children) is not supported yet: ${childless}`,
    );
  }
  return undefined;
}

/**
 * Problems with a value: its form, values the targets render differently, and code or a
 * document the compiler cannot analyse.
 */
function valueProblem(tag: string, attribute: ReadAttribute, unique: boolean): Problem | undefined {
  const { name, value, node } = attribute;
  if (isBooleanAttribute(name)) {
    if (value === null) return undefined;
    if (name === "hidden" && value.toLowerCase() === "until-found") {
      return {
        code: "UF3008",
        message: '`hidden="until-found"` is not supported: React renders `hidden` as a boolean.',
      };
    }
    const redundant = value === "" || value.toLowerCase() === name;
    return {
      code: "UF3004",
      message: redundant
        ? `\`${name}\` is a boolean attribute: write it without a value.`
        : `\`${name}\` is a boolean attribute: it is on whenever it is present, so \`${name}="${value}"\` is on too.`,
      help: redundant ? undefined : "Write it without a value to turn it on, or remove it.",
      fixes: redundant
        ? [
            {
              title: `Write \`${name}\` without a value`,
              confidence: "safe",
              edits: [{ span: { start: attribute.nameNode.end, end: node.end }, text: "" }],
            },
          ]
        : [],
    };
  }
  if (value === null) {
    if (TRUE_VALUED_ATTRIBUTES.has(name) || isDataAttribute(name)) return undefined;
    // HTML reads a bare attribute as the empty string, so that is the likely meaning; the fix
    // is offered only where the compiler accepts it (not `src=""` or `rows=""`).
    const empty = !valueProblem(tag, { ...attribute, value: "" }, unique);
    return {
      code: "UF3004",
      message: `\`${name}\` needs a value: in JSX an attribute without one means the string "true".`,
      help: `Write the value, such as \`${name}=""\`.`,
      fixes: empty
        ? [
            {
              title: `Write \`${name}=""\``,
              confidence: "likely",
              edits: [
                {
                  span: { start: attribute.nameNode.end, end: attribute.nameNode.end },
                  text: '=""',
                },
              ],
            },
          ]
        : [],
    };
  }
  const generated = generatedIdProblem(name, value);
  if (generated) return generated;
  if (name === "class") return classProblem(attribute, unique);
  const unanalysable = unanalysableUrl(tag, name, value);
  if (unanalysable === "javascript") {
    return {
      code: "UF3008",
      message: `\`${name}\` runs a \`javascript:\` URL: React blocks these, and the compiler cannot analyse the code.`,
      help: "Run code from an event handler.",
    };
  }
  if (unanalysable === "data") {
    return {
      code: "UF3008",
      message: `<${tag}> loads its \`${name}\` as a document, and the compiler cannot analyse one written in a \`data:\` URL.`,
      help: "Load the document from another URL, or write its markup in the component.",
    };
  }
  if (isDroppedEmptyUrl(tag, name, value)) {
    return {
      code: "UF3008",
      message: `An empty \`${name}\` is not supported: React drops it and warns.`,
      help: "Remove the attribute, or give it a URL.",
    };
  }
  const numeric = NUMERIC_ATTRIBUTES.get(tag)?.get(name);
  if (numeric) return numberProblem(attribute, numeric);
  return undefined;
}

/**
 * An authored id, or a reference to one, that starts with the generated-id prefix. The tests
 * recognise generated ids by that prefix alone (every target's `useId` writes it), so an
 * authored one would be renamed like a generated id and could hide a real difference. The
 * references are read as the tests' normaliser reads them (`idReferencesIn`): in `id` and the
 * idref attributes, in a `#id` URL, and in `url(#id)` in any other value.
 */
function generatedIdProblem(name: string, value: string): Problem | undefined {
  const reserved = idReferencesIn(name, value).find((id) => id.startsWith(GENERATED_ID_PREFIX));
  if (!reserved) return undefined;
  return {
    code: "UF3005",
    message: `\`${reserved}\` is reserved: ids starting with \`${GENERATED_ID_PREFIX}\` are the ones the compiler generates.`,
    help: "Choose an id with another prefix.",
  };
}

/**
 * A `class` with no names, which Vue renders as `class=""` and Svelte and Angular leave out,
 * or with a name holding whitespace that is not ASCII's, which Angular splits at (it reads
 * names with JavaScript's `\s`) and Vue and Svelte keep in the name.
 */
function classProblem(attribute: ReadAttribute, unique: boolean): Problem | undefined {
  const { value, node } = attribute;
  if (!classNames(value!)) {
    return {
      code: "UF3004",
      message:
        "This `class` has no class names: Vue renders it empty, and the others leave it out.",
      help: "Remove it.",
      fixes: unique
        ? [
            {
              title: "Remove the empty `class`",
              confidence: "safe",
              edits: [{ span: { start: attribute.after, end: node.end }, text: "" }],
            },
          ]
        : [],
    };
  }
  const space = /[^\S\t\n\f\r ]/.exec(value!)?.[0];
  if (space === undefined) return undefined;
  const code = `U+${space.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
  return {
    code: "UF3008",
    message: `A class name holds whitespace (${code}): Angular splits names there, and the other targets keep it in the name.`,
    help: "Separate class names with spaces, and keep other whitespace out of them.",
  };
}

const NUMBER_NAMES: Readonly<Record<NumberKind, string>> = {
  integer: "an integer",
  "non-negative-integer": "a non-negative integer",
  "positive-integer": "a positive integer",
  number: "a number",
};

/**
 * A numeric attribute's value must be a number of its kind, in range and in canonical form:
 * renderers that set the DOM property (Vue) or parse the number (React) rewrite or drop any
 * other spelling (`canonicalNumber`). A number in HTML's syntax but not canonical (`03`, `1e3`)
 * has a fix.
 */
function numberProblem(
  attribute: ReadAttribute,
  numeric: { kind: NumberKind; max?: number },
): Problem | undefined {
  const { name, value, node } = attribute;
  const { kind, max } = numeric;
  const canonical = canonicalNumber(value!, numeric);
  if (canonical === undefined) {
    return {
      code: "UF3008",
      message: `\`${name}\` takes ${NUMBER_NAMES[kind]}${max === undefined ? "" : ` up to ${max}`}, and "${value}" is not one.`,
      help: "Renderers that set the DOM property rewrite or reject any other value.",
    };
  }
  if (canonical === value) return undefined;
  return {
    code: "UF3004",
    message: `\`${name}="${value}"\` is written \`${name}="${canonical}"\`: some renderers set it as a DOM property, which rewrites the number.`,
    fixes: [
      {
        title: `Write ${canonical}`,
        confidence: "safe",
        edits: [{ span: span(node.value!), text: `"${canonical}"` }],
      },
    ],
  };
}

function unsupported(message: string, help?: string): Problem {
  return { code: "UF1002", message, ...(help ? { help } : {}) };
}

function report(reporter: Reporter, node: AST.JSXIdentifier, problem: Problem): void {
  if (problem.code === "UF1002") {
    reporter.unsupported(node, problem.message, problem.help ? { help: problem.help } : {});
    return;
  }
  reporter.report(problem.code, node, problem.message, {
    ...(problem.help ? { help: problem.help } : {}),
    ...(problem.fixes?.length ? { fixes: problem.fixes } : {}),
  });
}

function span(node: { start: number; end: number }): { start: number; end: number } {
  return { start: node.start, end: node.end };
}

/** `a`, `a and b`, `a, b and c` (or `or`, for alternatives). */
export function list(items: readonly string[], conjunction: "and" | "or" = "and"): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}
