// HTML that the targets render differently from one another: a framework acts on it instead of
// rendering it, sets it as a DOM property, reads it as template syntax or drops it. The analyser
// reports each of these at its source, and `checkInvariants` rejects them in any IR, so no target
// is handed markup it would render differently. One copy, so the two cannot disagree.
//
// What is not here is the analyser's alone: how JSX reads text, the names the compiler and the
// frameworks reserve for themselves, and the nesting the HTML parser repairs.

import { TEXTLESS_ELEMENTS } from "./html.ts";
import { table, words } from "./tables.ts";

/**
 * HTML elements a target does not render as the element, and why. A stop-gap until targets
 * declare per-element capabilities: these belong in the Vue target's capability matrix then.
 */
export const UNPORTABLE_ELEMENTS: ReadonlyMap<string, string> = table({
  search: "Vue 3.5 does not know <search> as an HTML element and resolves it as a component.",
  selectedcontent:
    "Vue 3.5 does not know <selectedcontent> as an HTML element and resolves it as a component.",
});

/** Global attributes a target reads as its template syntax, and why. */
export const TEMPLATE_SYNTAX_ATTRIBUTES: ReadonlyMap<string, string> = table({
  is: "`is` is template syntax: Vue resolves `vue:` values as components, and the others create customised built-in elements.",
  slot: "`slot` is template syntax: Svelte rejects it outside a component and Astro moves the element into a slot.",
});

/** A framework whose element types decide whether its output type-checks (L4). */
export type TypedFramework = "React" | "Vue" | "Svelte";

/**
 * Attributes some framework's element types do not declare, by element (`*` for every one), with
 * the frameworks that lack them: TSX checks every attribute name without a hyphen, and Vue's
 * strict templates and svelte-check every name, so that framework's output fails its
 * type-check (L4) whatever the value. Vue's types are also the authoring types, so a name they
 * lack fails the source's own type-check. The analyser reports these (UF1002) until the types
 * declare them, and `checkInvariants` rejects them; the analyser's conformance tests check each
 * entry against the frameworks' types. `<link>` and `<template>` are not rendered yet.
 */
export const UNDECLARED_ATTRIBUTES: ReadonlyMap<
  string,
  ReadonlyMap<string, readonly TypedFramework[]>
> = new Map(
  Object.entries<Readonly<Record<string, readonly TypedFramework[]>>>({
    "*": {
      popover: ["Vue"],
      writingsuggestions: ["React", "Vue"],
    },
    area: { ping: ["React", "Vue"] },
    button: {
      command: ["React", "Vue"],
      commandfor: ["React", "Vue"],
      popovertarget: ["Vue"],
      popovertargetaction: ["Vue"],
    },
    dialog: { closedby: ["Vue"] },
    form: { rel: ["Vue"] },
    img: { ismap: ["React", "Vue"] },
    input: {
      dirname: ["React", "Vue"],
      popovertarget: ["Vue"],
      popovertargetaction: ["Vue"],
    },
    link: { disabled: ["React"] },
    source: { height: ["Vue"], width: ["Vue"] },
    template: Object.fromEntries(
      [
        "shadowrootclonable",
        "shadowrootcustomelementregistry",
        "shadowrootdelegatesfocus",
        "shadowrootmode",
        "shadowrootserializable",
      ].map((name) => [name, ["React"] as const]),
    ),
    textarea: { dirname: ["React"] },
  }).map(([tag, attributes]) => [tag, table(attributes)]),
);

/** ARIA 1.3's draft attributes, which Vue's and Svelte's element types do not declare yet. */
export const DRAFT_ARIA_ATTRIBUTES: ReadonlySet<string> = words(
  "aria-braillelabel aria-brailleroledescription aria-description",
);

/** The frameworks whose element types do not declare an attribute of an element, if any. */
export function undeclaredBy(
  tag: string,
  namespace: "html" | "svg",
  name: string,
): readonly TypedFramework[] | undefined {
  if (DRAFT_ARIA_ATTRIBUTES.has(name)) return ["Vue", "Svelte"];
  if (namespace !== "html") return undefined;
  return UNDECLARED_ATTRIBUTES.get(tag)?.get(name) ?? UNDECLARED_ATTRIBUTES.get("*")?.get(name);
}

/**
 * Why an attribute of an element fails some framework's type-check, or `undefined`: "React's
 * and Vue's element types do not declare `ismap` (…), so their outputs would not type-check".
 */
export function undeclaredAttribute(
  tag: string,
  namespace: "html" | "svg",
  name: string,
): string | undefined {
  const frameworks = undeclaredBy(tag, namespace, name);
  if (!frameworks) return undefined;
  const owners = frameworks.map((framework) => `${framework}'s`);
  const types = `${owners.length > 1 ? `${owners.slice(0, -1).join(", ")} and ` : ""}${owners.at(-1)!} element types`;
  const what = DRAFT_ARIA_ATTRIBUTES.has(name)
    ? `\`${name}\` is an ARIA 1.3 draft, which ${types} do not declare`
    : `${types} do not declare \`${name}\``;
  // TSX checks no name with a hyphen, so the source type-checks with an undeclared ARIA name.
  const authoring =
    frameworks.includes("Vue") && !name.includes("-") ? " (Vue's are the authoring types)" : "";
  const outputs = frameworks.length > 1 ? "their outputs" : `${frameworks[0]!}'s output`;
  return `${what}${authoring}, so ${outputs} would not type-check`;
}

/** Global attributes a target acts on instead of rendering, and why. */
export const UNRENDERED_ATTRIBUTES: ReadonlyMap<string, string> = table({
  autofocus: "React focuses the element itself and renders no attribute in the browser.",
});

/**
 * Attributes that hold an element's state, by element: form state (which lands with `v-model`)
 * and a media element's `muted`. Their DOM property does not write the attribute back, and
 * some targets set the property where others set the attribute, so the server's markup has
 * the attribute where a client's DOM does not.
 */
export const STATE_ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = table({
  audio: words("muted"),
  input: words("checked value"),
  option: words("selected"),
  video: words("muted"),
});

/**
 * Input types whose `value` is a fixed label or submitted value, never edited state: their
 * `value` property writes the attribute back, so `value` renders alike on them.
 */
export const FIXED_VALUE_INPUT_TYPES: ReadonlySet<string> = words(
  "button checkbox hidden image radio reset submit",
);

/**
 * Whether an attribute holds the element's state (`STATE_ATTRIBUTES`), given the element's
 * `type` attribute, if any (an enumerated attribute, so read without case).
 */
export function isStateAttribute(tag: string, name: string, type: string | undefined): boolean {
  if (tag === "input" && name === "value") {
    return !FIXED_VALUE_INPUT_TYPES.has(type?.toLowerCase() ?? "");
  }
  return STATE_ATTRIBUTES.get(tag)?.has(name) ?? false;
}

/**
 * The elements whose bound `value` the targets render differently once it is `null` or
 * `undefined`, and why: Svelte's client sets the `value` property (no markup reaches
 * `setAttribute` for it), which an <li>, a <meter> or a <progress> reflects as "0", and a
 * <data>, a <button> or an input of a type whose value is a label (`FIXED_VALUE_INPUT_TYPES`)
 * as "" or "null"; Solid sets the property too, which writes "0" for a `null` on an <li> or a
 * <meter>. Both write an <option>'s on mount: Svelte as "", Solid as "null" or "undefined". The
 * other targets leave the attribute out. The analyser reports a bound `value` that may be
 * nullish there (UF1002). The IR holds no kinds, so `checkInvariants` cannot tell.
 */
export const NULLISH_VALUE_ELEMENTS: ReadonlyMap<string, string> = new Map([
  ...[...words("li meter progress")].map(
    (tag) =>
      [
        tag,
        `Svelte sets the <${tag}>'s \`value\` property, which writes "0" once it is null or undefined, and Solid writes "0" for \`null\`, where the other targets leave the attribute out.`,
      ] as const,
  ),
  ...[...words("data button input")].map(
    (tag) =>
      [
        tag,
        `Svelte sets the <${tag}>'s \`value\` property, which writes "" or "null" once it is null or undefined, where the other targets leave the attribute out.`,
      ] as const,
  ),
  [
    "option",
    'Svelte writes a null or undefined `value` of an <option> as "", and Solid as "null" or "undefined", where the other targets leave the attribute out.',
  ],
]);

/** Attributes the targets render differently on an element with children, and why. */
export const CHILDLESS_ATTRIBUTES: ReadonlyMap<string, string> = table({
  contenteditable: "React warns that the user's edits would conflict with the children it renders.",
});

/**
 * Whether React drops an empty URL attribute, and reports it: an empty `src` or `data`, or an
 * empty `href` anywhere but on a link. The other targets render it.
 */
export function isDroppedEmptyUrl(tag: string, name: string, value: string): boolean {
  return value === "" && (name === "src" || name === "data" || (name === "href" && tag !== "a"));
}

/**
 * Elements whose whitespace-only text Svelte's compiler drops and the other targets keep:
 * `<select>`, `<datalist>` and the table parts, where React also reports it as a hydration
 * error.
 */
export const WHITESPACE_DROPPING_ELEMENTS: ReadonlySet<string> = new Set([
  "datalist",
  "select",
  ...TEXTLESS_ELEMENTS,
]);

/** Whether a text is only HTML's ASCII whitespace, which is all those elements drop. */
export function isWhitespaceText(value: string): boolean {
  return /^[\t\n\f\r ]+$/.test(value);
}

/**
 * Why the attributes that decide which option a `<select>` starts with selected cannot be
 * bound: a drop-down selects its first enabled option, a list box (`size`, `multiple`) none, and
 * Svelte's, Solid's and Qwik's clients insert the options before they set a bound one, so the
 * browser has selected the first option by then. Static values are set first everywhere.
 */
const SELECTION =
  "it decides which option starts selected, and Svelte's, Solid's and Qwik's clients insert the options before they set it, so their first option is selected. It lands with form state in M3.";

/**
 * Attributes that cannot be bound in M1, by element, and why (ADR-0037): Angular reads them as
 * resource URLs, whose bound value it rejects unless trusted (NG0904), or refuses to bind them
 * at all (`ATTRIBUTE_NO_BINDING`, NG0910); and a bound `src` or `data` that loads a nested
 * document could load a `data:` document, which the invariants keep out of static values
 * (`NESTED_DOCUMENT_ATTRIBUTES`); and the attributes that decide a `<select>`'s first selection.
 * Static values stay valid. The analyser reports a bound one
 * (UF1002), and no IR binds one, as a bound attribute or a spread's key.
 */
export const UNBINDABLE_ATTRIBUTES: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(
  Object.entries<Readonly<Record<string, string>>>({
    embed: {
      src: "Angular reads a bound `src` on <embed> as a resource URL and throws for any value it does not trust (NG0904).",
    },
    iframe: {
      src: "Angular reads a bound `src` on <iframe> as a resource URL and throws for any value it does not trust (NG0904).",
      allow: "Angular refuses to bind `allow` on <iframe> (NG0910).",
      allowfullscreen: "Angular refuses to bind `allowfullscreen` on <iframe> (NG0910).",
      referrerpolicy: "Angular refuses to bind `referrerpolicy` on <iframe> (NG0910).",
      sandbox: "Angular refuses to bind `sandbox` on <iframe> (NG0910).",
    },
    object: {
      data: "Angular reads a bound `data` on <object> as a resource URL and throws for any value it does not trust (NG0904).",
    },
    optgroup: { disabled: SELECTION },
    option: { disabled: SELECTION },
    select: { multiple: SELECTION, size: SELECTION },
  }).map(([tag, attributes]) => [tag, table(attributes)]),
);

/** Why an attribute of an element cannot be bound (`UNBINDABLE_ATTRIBUTES`), or `undefined`. */
export function unbindableAttribute(tag: string, name: string): string | undefined {
  return UNBINDABLE_ATTRIBUTES.get(tag)?.get(name);
}

/**
 * HTML elements no interpolation renders in alike, and why: the analyser reports one there
 * (UF3003, or UF1002 for a `<textarea>`'s value), and no IR holds one, directly or in a branch.
 */
export const UNINTERPOLATED_ELEMENTS: ReadonlyMap<string, string> = new Map([
  ...[...TEXTLESS_ELEMENTS].map(
    (tag) =>
      [
        tag,
        `the HTML parser moves text out of a <${tag}>, so the server's markup and a client's DOM differ.`,
      ] as const,
  ),
  ...["datalist", "select"].map(
    (tag) =>
      [
        tag,
        `a <${tag}> renders no text, and Svelte drops the whitespace in it that the other targets keep.`,
      ] as const,
  ),
  [
    "textarea",
    "a <textarea>'s content is its value, which Svelte sets as a property: form state lands with `v-model` (M3).",
  ],
  [
    "iframe",
    "the HTML parser reads an <iframe>'s content as raw text, decoding no character reference and reading no comment, so the server's escaped markup and a client's DOM differ; and a browser never shows it.",
  ],
]);

/**
 * The HTML elements a component can render whose content the parser reads as raw text: no
 * character reference is decoded and no comment is read, so the escaped text each server writes,
 * and the comments the frameworks mark a conditional with, become text that a client render
 * does not hold. The analyser reports any text there but whitespace, and any conditional
 * (UF3003), and no IR holds one; elements there are text-only elements' (`TEXT_ONLY_ELEMENTS`),
 * and interpolations uninterpolated elements' (`UNINTERPOLATED_ELEMENTS`).
 */
export const RAW_TEXT_ELEMENTS: ReadonlySet<string> = words("iframe");

/**
 * Elements whose content loses a leading line feed: the HTML parser drops one that starts it,
 * React's server renderer writes an extra one to keep it, and a client's DOM keeps it as
 * written. A text can start the content after a conditional or a list that renders nothing,
 * where React's and Astro's servers write nothing before it and the other targets a comment,
 * which keeps it. The analyser reports a text that can start the content with one there
 * (UF3017), and no IR holds one.
 */
export const LEADING_LINE_FEED_ELEMENTS: ReadonlySet<string> = words("listing pre textarea");

/**
 * Whether Angular's template writes a regular expression literal (`/a;b/u`, as written) with
 * escapes: a quote, `;`, whitespace but a lone space, U+E500, a parenthesis in a class, a `{`
 * before another, a `<` before a letter, or a body that would write `//` (the Angular dialect's
 * `angularRegex`, which this may only over-approximate). The escapes match the same text, so
 * `.test()` and a string method read alike, but the expression's `source` and string form hold
 * them: the analyser reports a read of its text (UF1002).
 */
export function angularRespellsRegex(raw: string): boolean {
  const close = raw.lastIndexOf("/");
  const body = raw.slice(1, close);
  const escaped =
    /['"`;\f\n\r\t\v\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\ue500]| {2}|\\ |\{\{/;
  if (escaped.test(body) || `/${body}/`.includes("//")) return true;
  let inClass = false;
  for (let index = 0; index < body.length; index++) {
    const character = body[index]!;
    if (character === "\\") index++;
    else if (character === "[") inClass = true;
    else if (character === "]") inClass = false;
    // A parenthesis in a class, which Angular's block lexer would count.
    else if (inClass && (character === "(" || character === ")")) return true;
    // A `<` before a letter opens a tag in an interpolation, unless it opens a group's name or a
    // lookbehind (`(?<x>`, `(?<!`) or names a group (`\k<x>`).
    else if (
      character === "<" &&
      /[A-Za-z!/?]/.test(body[index + 1] ?? "") &&
      !(
        !inClass &&
        (body.slice(index - 2, index) === "(?" || body.slice(index - 2, index) === "\\k")
      )
    ) {
      return true;
    }
  }
  return false;
}
