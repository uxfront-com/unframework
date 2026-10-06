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
 * cannot be read as `name()` in a template, and a template variable named after one cannot be
 * read at all (`@for (as of items; …)` does not parse).
 */
export const ANGULAR_KEYWORDS: ReadonlySet<string> = words(
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
  Fragment:
    "Astro's output renders `<>` with the `Fragment` it imports, which the prop would hide.",
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

/**
 * Why the object form's props parameter cannot take a name, or `undefined` (ADR-0034): Astro's
 * compiled component declares `$$props`, `$$result`, `$$slots` and `$$render` in the scope where
 * its output declares the props object, and imports its other helpers under names starting
 * with `$$` too. (Svelte's output renames a props object Svelte reserves, `$` included.)
 */
export function reservedPropsParameterName(name: string): string | undefined {
  return name.startsWith("$$")
    ? "Astro's compiled component declares the names starting with `$$` (`$$props`, `$$result`, `$$slots`, `$$render`) where its output declares the props object"
    : undefined;
}

/**
 * Why a list's or an arrow function's parameter cannot take a name whatever the component
 * declares, or `undefined` (ADR-0035, UF3024): the name of a global an expression may read,
 * `props` and `rawProps`, which some outputs declare, `Fragment`, which Astro's output renders
 * `<>` with, a name starting with `$`, as the variables Angular's `@for` declares (`$index`), a
 * name starting with `_` but `_` itself, as Vue's compiled render functions declare (`_ctx`,
 * `__props`), and an Angular expression keyword, which its templates cannot read as a name
 * (`as`; the others are reserved words). A parameter cannot take the name of a prop, of the
 * object form's parameter or of a loop variable around it either.
 */
export function reservedParameterName(name: string): string | undefined {
  if (ALLOWED_GLOBALS.has(name)) return `it would shadow the global \`${name}\``;
  if (name === "props" || name === "rawProps") return `some outputs declare \`${name}\``;
  if (name === "Fragment") return "Astro's output renders `<>` with the `Fragment` it imports";
  if (name.startsWith("$")) return "Angular's `@for` declares the names starting with `$`";
  if (name.length > 1 && name.startsWith("_")) {
    return "Vue's compiled render functions declare names starting with `_` (`_ctx`, `__props`)";
  }
  if (ANGULAR_KEYWORDS.has(name)) return "it is a keyword in Angular's template expressions";
  return undefined;
}

/**
 * Names a local type cannot take, and why: the outputs declare or import a type of the name
 * beside the module's own. `Props` is the one exception, as a component's own props type, which
 * the outputs keep, when every component whose props reach it takes it as its props type: Astro's
 * output declares its own `Props` for any other. Angular's `Component` is a decorator and an
 * interface: a local type merges
 * with it, and Angular's compiler no longer reads the class's signal inputs (NG8110).
 */
export const RESERVED_TYPE_NAMES: ReadonlyMap<string, string> = new Map([
  ["Props", "the outputs declare a type of that name for a component's props"],
  ["CSSProperties", "the outputs declare a type of that name for style objects"],
  [
    "Component",
    "Angular's output imports its `Component` decorator, which is also a type, by that name",
  ],
  [
    "Partial",
    "Solid's output checks its defaults with TypeScript's `Partial`, which it would hide",
  ],
  [
    "Record",
    "Solid's output spreads the attributes its types lack from a TypeScript `Record`, which it would hide",
  ],
  [
    "Required",
    "Solid's output types its object defaults as TypeScript's `Required<Pick<…>>`, which it would hide",
  ],
  [
    "Pick",
    "Solid's output types its object defaults as TypeScript's `Required<Pick<…>>`, which it would hide",
  ],
  [
    "Exclude",
    "Angular's output types an input with a default as TypeScript's `Exclude<…, undefined>`, which it would hide",
  ],
]);
