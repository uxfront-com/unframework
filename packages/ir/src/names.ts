import { words } from "./tables.ts";

/**
 * Whether a name can be a component's: PascalCase, in ASCII letters and digits, as the parser
 * finds components. Every target writes it as an identifier and names the output file by it
 * (`Card.vue`, `card.ts`), so nothing else is both.
 */
export function isComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

/**
 * Whether a name can be exported: `default`, or an ECMAScript IdentifierName, which a consumer
 * can import and use as a tag.
 */
export function isExportName(name: string): boolean {
  return name === "default" || /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u.test(name);
}

/**
 * Whether a name is an identifier every target can write in an expression: ASCII only, since
 * Angular's expression lexer reads no other letter (ADR-0035).
 */
export function isIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/**
 * The globals an expression may read (ADR-0035): pure, deterministic built-ins every target
 * reaches, which Vue's templates allow and the Angular target declares as component members.
 * `Date`, `Intl`, `crypto`, `performance` and `globalThis` are not: they make the rendering
 * depend on time, locale or randomness.
 */
export const ALLOWED_GLOBALS: ReadonlySet<string> = words(`
  undefined NaN Infinity Math Number String Boolean Array Object JSON parseInt parseFloat isNaN
  isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
`);

/**
 * ECMAScript's reserved words in strict mode (the targets' output is modules), with `arguments`
 * and `eval`, which strict mode does not let a binding take.
 */
const RESERVED_WORDS: ReadonlySet<string> = words(`
  await break case catch class const continue debugger default delete do else enum export
  extends false finally for function if implements import in instanceof interface let new null
  package private protected public return static super switch this throw true try typeof var
  void while with yield arguments eval
`);

/**
 * Words Angular's expression lexer reads as keywords (`KEYWORDS`, 22): an input named after one
 * cannot be read as `name()` in a template.
 */
const ANGULAR_KEYWORDS: ReadonlySet<string> = words(
  "var let as null undefined true false if else this typeof void in instanceof",
);

/** Names a target reads as its own, or declares beside the props, and why. */
const RESERVED_NAMES: Readonly<Record<string, string>> = {
  key: "`key` is the frameworks' list identity, not a prop.",
  ref: "`ref` gives the frameworks a component instance, not a prop.",
  children: "`children` is React's and Solid's slot content (slots land in M3).",
  class: "`class` falls through to a component's root on Vue (fallthrough lands in M3).",
  style: "`style` falls through to a component's root on Vue (fallthrough lands in M3).",
  slot: "`slot` places a component into a slot on Vue, Svelte and Astro.",
  is: "`is` is template syntax: Vue resolves `vue:` values as components.",
  props: "`props` names the props object the Solid and object-form outputs declare.",
  rawProps: "`rawProps` names the props object the Solid output merges defaults into.",
  Astro: "`Astro` is the global an Astro component reads its props from.",
  constructor: "`constructor` would be the Angular component class's constructor.",
  ref_for: "`ref_for` is a prop Vue reserves for template refs.",
  ref_key: "`ref_key` is a prop Vue reserves for template refs.",
};

/**
 * Prop names no target can declare or read as an ordinary prop, and why (ADR-0034): the names
 * the frameworks read as their own, the names the outputs declare beside the props, ECMAScript's
 * reserved words (strict mode), Angular's expression keywords, and the allowed globals (the
 * Angular target declares one member for a prop and a global of one name). The analyser
 * reports them (UF2003), and no IR holds one; `reservedPropName` also reads the patterns.
 */
export const RESERVED_PROP_NAMES: ReadonlyMap<string, string> = new Map([
  ...[...ALLOWED_GLOBALS].map(
    (name) =>
      [
        name,
        `\`${name}\` is a global expressions may read, which the Angular target declares as a member.`,
      ] as const,
  ),
  ...[...ANGULAR_KEYWORDS].map(
    (name) => [name, `\`${name}\` is a keyword in Angular's template expressions.`] as const,
  ),
  ...[...RESERVED_WORDS].map(
    (name) => [name, `\`${name}\` is a reserved word in JavaScript's strict mode.`] as const,
  ),
  ...Object.entries(RESERVED_NAMES),
]);

/**
 * The prop names every target can declare and read as an identifier: ASCII letters and digits
 * (Angular's lexer is ASCII-only), starting with a letter.
 */
export const PROP_NAME_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Why a target cannot take a prop of this name, or `undefined` when every target can: a name
 * outside {@link PROP_NAME_PATTERN} or in {@link RESERVED_PROP_NAMES}, an event's name
 * (`onClick`: events land in M2), or a name Angular reserves for its own directives (`ngIf`).
 * (`PROP_NAME_PATTERN` also rules out a name ending in `$`, which Qwik reads as a QRL.)
 */
export function reservedPropName(name: string): string | undefined {
  if (!PROP_NAME_PATTERN.test(name)) {
    return `\`${name}\` is not ASCII letters and digits starting with a letter, which every target can declare.`;
  }
  const reserved = RESERVED_PROP_NAMES.get(name);
  if (reserved) return reserved;
  if (/^on[A-Z]/.test(name)) return `\`${name}\` is an event's name: events land in M2.`;
  if (/^ng[A-Z]/.test(name)) return `\`${name}\` is a name Angular reserves for its directives.`;
  return undefined;
}
