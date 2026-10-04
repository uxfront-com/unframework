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
 * Attributes that cannot be bound in M1, by element, and why (ADR-0037): Angular reads them as
 * resource URLs, whose bound value it rejects unless trusted (NG0904), or refuses to bind them
 * at all (`ATTRIBUTE_NO_BINDING`, NG0910); and a bound `src` or `data` that loads a nested
 * document could load a `data:` document, which the invariants keep out of static values
 * (`NESTED_DOCUMENT_ATTRIBUTES`). Static values stay valid. The analyser reports a bound one
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
]);

/**
 * Elements whose content loses a leading line feed: the HTML parser drops one that starts it,
 * React's server renderer writes an extra one to keep it, and a client's DOM keeps it as
 * written. The analyser reports a text that starts with one there (UF3017), and no IR holds
 * one.
 */
export const LEADING_LINE_FEED_ELEMENTS: ReadonlySet<string> = words("listing pre textarea");
