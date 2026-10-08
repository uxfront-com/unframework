# ADR-0034: Props are a typed signature parameter with local types and static defaults

- **Status:** Accepted, amended by ADR-0045 and ADR-0049
- **Date:** 2026-10-05
- **Plan:** §4.1, §4.2, §6 (signature props), §9 M1; P2, P3, P4, P6; R5, R6; ADR-0001, ADR-0007,
  ADR-0033; amends ADR-0032

## Context

ADR-0001 puts props in the component's signature, and ADR-0007 makes the destructured form
canonical, with `(props: P)` accepted when nothing has a default. M1 lowers them to seven targets.
Each framework applies defaults, casts values and types props in its own way, and M1 has no type
oracle (M5, §5.5), so the analyzer reads the props type syntactically.

Probes against the installed frameworks found differences that the obvious mappings would let
through silently (P2, P4):

- **Vue casts props by their inferred runtime types.** An absent Boolean prop becomes `false`; and
  when `Boolean` comes before `String` in the inferred types, `""` and the prop's own hyphenated
  name become `true`. The other six targets pass the value through.
- **Qwik's optimizer lowers destructured defaults to `??`**, so an explicit `null` takes the default
  on Qwik only.
- **Angular's `input(default)` ignores the default** when the consumer sets `undefined` explicitly,
  where JavaScript destructuring applies it.
- **Angular's type checker never narrows a signal call.** `phone() && phone().length` fails with
  TS2532 where the source type-checks.
- **Solid's `mergeProps` widens literal defaults** (`"info"` becomes `string`), which fails L4 in a
  typed position such as `crossorigin`.
- **Names collide with each output's own syntax:** Angular's lexer is ASCII-only and reads `as`,
  `typeof` or `undefined` as keywords; Astro's `const { Astro } = Astro.props` is a temporal dead
  zone error; Vue reserves `ref_key` and `ref_for`; and each output declares names of its own
  beside the props (`rawProps`, `Props`, `CSSProperties`, Angular's `Component`).

## Decision

- **A component is a function declaration** (plan §4.1). An exported PascalCase `const` that holds
  an arrow function or a function expression returning JSX (`export const Card = (…) => …`, or a
  `const` exported later) is UF1102, with a likely fix that writes
  `export function Card(…) { return …; }`, keeping the parameters and the body. It is checked as
  the declaration the fix writes, so the fix reveals nothing new. A typed or `async` value, a
  comment the fix would lose, `export default () => …` and a lower-case name get UF1102 without
  a fix.
- **Forms.** The first and only parameter is the props:
  - destructured: shorthand identifiers, each with an optional default (`{ a, b = 1 }`). Renames,
    nested patterns, computed or string keys and names that are not members of the type are
    UF2001; a rest element is fallthrough, UF1002 until M3;
  - object: an identifier, only when no member needs a default. Every use is a non-computed member
    read `props.x` of a declared member; any other use is UF2001, and `props?.x` is UF3023. The
    targets splice `props.x` as one reference, so `(props).x` is UF2001, with a safe fix that
    removes the parentheses. A name starting with `$$` is UF2001: Astro's compiled component
    declares `$$props`, `$$result` and `$$render` where its output declares the props object;
  - a second parameter, a parameter default, an array pattern or an optional parameter is UF2001.
- **The annotation is required** (UF2001). It is an inline object type literal, a local
  `interface`, or a local `type` alias of an object type literal or of another local reference,
  followed through aliases and parentheses. An interface declared twice, one that extends another,
  a generic one, an ambient `declare` and a generic component are UF1002; any other annotation is
  UF1002, "lands in M5".
- **Member types are a closed set:** `string`, `number`, `boolean`, `null`, `undefined`, literal
  types (string, number, boolean, template literals without holes), unions of these, arrays
  (`T[]`, `readonly T[]`, `Array<T>`, `ReadonlyArray<T>`), object type literals and local
  interfaces and aliases, followed lazily. A member declared twice in one type is UF2001, reported
  once: TypeScript rejects the second (TS2300), and every target would declare the prop twice.
  UF1002 otherwise:
  - a function type, a method, call or construct signature anywhere: callbacks are events (M2),
    render functions are slots (M3);
  - `any`, `unknown`, `object`, `{}`, `symbol`, `bigint`, `void`, `never`, tuples, intersections,
    type operators, template literal types with holes, index signatures, computed keys, utility,
    imported and global types (an enum is a module-level declaration, UF1002 itself): M5;
  - a union that holds both a boolean and a string type Vue would read as `true`, through
    aliases and literals: `string` itself, `""`, or the prop's own name in kebab case (Vue's
    casting, below). A boolean beside other string literals renders alike (`boolean | "mixed"`,
    as tri-state ARIA takes).
- **Names** match `PROP_NAME_PATTERN`, `/^[A-Za-z][A-Za-z0-9]*$/`, because Angular's lexer is
  ASCII-only (the pattern also rules out Qwik's trailing `$`), and are not reserved (UF2003 for
  both). `RESERVED_PROP_NAMES` in `@unframework/ir` holds, each with its reason:
  - the names JSX and the frameworks give meaning to: `key`, `ref`, `children`, `class`, `style`,
    `slot`, `is`, and Vue's `ref_for` and `ref_key`;
  - the names the outputs declare beside the props: `props`, `rawProps`, `Astro`, `Fragment`
    (Astro's output imports it to render `<>`), and `constructor` (it would be the Angular class's
    constructor);
  - every strict-mode reserved word, `arguments` and `eval`, Angular's expression keywords (`as`,
    `let`, `typeof`, `in`, `undefined`, …) and every allowed global (ADR-0035);
  - and the patterns `/^on[A-Z]/` (events, M2) and `/^ng[A-Z]/` (Angular's directives).

  A type name or an object-form parameter name outside ASCII is UF1002. A local type is UF2003 when
  an output declares or imports its name (`RESERVED_TYPE_NAMES`): `Props`, unless every component
  whose props reach it takes it as its props type, since Astro's output declares a `Props` of its
  own for any other (the help points at the props that reach it); `CSSProperties` (React);
  `Component`, Angular's decorator, which is also a type, so a local one merges with it and Angular
  no longer reads the class's signal inputs (NG8110); `Partial`, `Record`, `Required` and `Pick`,
  which Solid's output reads (its defaults and its attribute spreads); and `Exclude`, with which
  Angular's output types an input that has a default.

- **Defaults are static** (UF2002): string, number, boolean and `null` literals, negated numbers,
  template literals without expressions, and arrays and objects of those (identifier or string
  keys, no holes, spreads, computed keys or methods). `undefined` is an identifier, so it is not a
  default. A default on a required member is UF2001. A default on a member whose type admits
  `null` is UF2001 unless it is `null` (Qwik's `??`).
- **Copied text cannot end the block it lands in** (ADR-0041). A default, a copied type declaration
  or an inline props type that holds `</script`, in any case, or a line that is only `---`, is
  UF1002. A lint or type-check directive comment in them is UF1002 too, with a safe fix that
  removes it (ADR-0042).
- **Absent and `undefined` are the same** on every target: the prop takes its default or stays
  `undefined`. `null` is a value. One framework difference is declared for consumers, and lands
  with composition in M3: Qwik 2.0.0-beta.47 keeps a `null` that a parent writes as an attribute
  (`value={null}`), but deletes it from a spread (`{...attrs}`) or a direct `jsx()` call
  (`_jsxSplit`), so such a consumer passes `undefined` on Qwik. The harness's Qwik adapters build
  the component as the optimizer compiles written attributes (`_jsxSorted`), so the corpus delivers
  `null` (ADR-0043).
- **Props are the type's members**, not the pattern's entries. A member the pattern leaves out is
  still a prop, without a binding: Vue declares it through `defineProps<P>()` and Angular as an
  input, so a consumer's value for it never falls through to the root.
- **Type declarations are copied.** `UfModule.types` holds each top-level `interface` or `type` the
  props reach, as the exact source text, and each output declares its component's closure,
  exported as in the source. Angular declares the exported part of the closure and what an input's
  type reaches: its inputs are typed by their members, so a props interface the source does not
  export would be declared and never used. A declaration no props reach is UF1002 (shared types,
  M5); so are `import type` from anywhere but `unframework`, and type-only exports. A type import
  from a framework is UF1201.
- **Each target maps props its own way** (refining plan §6's row), and the capability `props` is
  native on all seven. The example shows the shapes; the rules follow it.

```tsx
export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
}

export default function Badge({ label, tone = "info", count }: BadgeProps) {
  return (
    <span data-tone={tone}>
      {label} {count}
    </span>
  );
}
```

```text
React    export default function Badge({ label, tone = "info", count }: BadgeProps)
Vue      const { label, tone = "info", count = undefined } = defineProps<BadgeProps>();
Svelte   let { label, tone = "info", count }: BadgeProps = $props();
Solid    export default function Badge(rawProps: BadgeProps) {
           const props = mergeProps({ tone: "info" } satisfies Partial<BadgeProps>, rawProps);
Angular  readonly label = input.required<string>();
         readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", {
           transform: (value) => (value === undefined ? "info" : value),
         });
         readonly count = input<number>();
         template: @let label = this.label(); @let tone = this.tone(); @let count = this.count();
Qwik     export default component$<BadgeProps>(({ label, tone = "info", count }) => {
Astro    type Props = BadgeProps;
         const { label, tone = "info", count } = Astro.props;
```

- **Unread props.** L5's unused-variable rules (ADR-0042) decide what a target leaves out:
  - React, Svelte, Qwik and Astro leave out a destructured prop no printed expression reads, with
    its default. When nothing is read, React writes `(_props: P)`, Svelte
    `let _props: P = $props();` (an empty pattern is `no-empty-pattern`), Qwik drops the parameter
    and keeps `component$<P>`, and Astro writes no statement. An object-form parameter nothing reads
    takes a `_` name on React and Svelte (`_p`); a source name that starts with `_` and has more
    (`_props`, `_unused`) says it is unused already and stays, on Solid too, and a bare `_`, which
    oxlint reports, becomes `__` on React and Svelte and `_props` on Solid. Astro prints no list
    keys, so a prop only a key reads is left out there too.
  - Vue keeps every optional prop in the pattern, read or not, because `vue/require-default-prop`
    asks for each one's default; an unread one is bound under a `_` local (`size: _size = 2`),
    which `no-unused-vars` ignores. Vue compiles the pattern away, so the local never meets the
    `_` names of Vue's own compiled code. An unread required prop is left out, and when nothing is
    read Vue writes `defineProps<P>();`.
  - Solid never destructures: it drops the defaults of unread props from `mergeProps`, writes
    `function Badge(props: P)` when no read prop has a default, and `_props` when nothing is read.
  - Angular declares every prop as an input, read or not, because a prop is the component's API
    and Angular reports a value for an undeclared input (NG0303); only the `@let` is left out.
- **Order.** React, Svelte, Qwik, Astro and Solid's defaults follow the source pattern's order; Vue
  and Angular follow the type's member order.
- **Vue** gives every optional prop without a default `= undefined`, which stops the absent-Boolean
  cast and satisfies `vue/require-default-prop`; rejecting the boolean-and-string unions it casts
  stops the other two casts. The object form is `const props = defineProps<P>()`, through
  `withDefaults(…, { count: undefined })` when a prop is optional. A prop named after a compiler
  macro (TS2451 in vue-tsc) or a global Vue's template compiler never prefixes (`Map`, `console`, …)
  is destructured under a fresh local, `{ Map: Map_1 }`, and an object named with Vue's `_` or `$`
  prefix is declared as `props`.
- **Angular**: a required prop is `input.required<T>()`, an optional one without a default
  `input<T>()`, and one with a default always takes the transform above: `value === undefined`,
  never `??`, because `null` is a value. The input's value type drops `undefined`, written out or
  as `Exclude<Alias, undefined>` for an alias that admits it. The template reads each prop it uses
  through one `@let name = this.name();`, because Angular's type checker narrows a template
  variable as TypeScript narrows a local but never a signal call, so every expression type-checks
  as in the source; a `track` expression reads `this.name()` (NG8009), and an unread `@let` would
  be NG8112. A component named `Component` is the class `Component_1`, exported under its own name,
  and `input` is imported under another name when a type takes it.
- **Solid** never destructures: every prop reference becomes `props.x`, the object form keeps its
  own name, and the defaults go through `mergeProps`, typed with `satisfies Partial<P>`
  (`Partial<{…}>` for an inline literal), which applies a default for an absent or `undefined`
  prop and keeps `null`. When a read default holds an object or an array literal (`{ title: "t" }`,
  `["info"]`), the defaults are a typed object of their own instead,
  `const defaults: Required<Pick<P, "attrs" | "tone">> = { … };`, merged as
  `mergeProps(defaults, rawProps)`. `satisfies` keeps the literal's own type, which lacks the
  optional members it leaves out (a read of `props.attrs.id` would fail L4), or holds only the
  literals an array lists (`"info"[]` for `Tone[]`, so `props.tones.includes(props.tone)` would
  fail L4), and `mergeProps` types the prop by both.
- **Astro** declares `Props`, which types `Astro.props` and the component's callers:
  `type Props = BadgeProps;`, `interface Props { … }` holding an inline literal's members, or
  nothing when the type is named `Props` already. A component that reads none of its props
  exports `Props` (`export type Props = X;`, `export interface Props {…}`, or the source's own
  `Props` with `export`): astro-eslint-parser counts Astro's implicit read of `Props` only in a
  file that names `Astro`, so typescript-eslint's `no-unused-vars` would report it (ADR-0042).
  Astro's guide allows the export, eslint-plugin-astro allows a type export, and `astro check`
  still types the callers by it. The object form is `const props = Astro.props;`,
  and an object named `Astro` or `Fragment` is declared as `props`.
- **Amendments to ADR-0032.** The invariants check props as the analyzer does: names every
  target can declare (the pattern and `RESERVED_PROP_NAMES`), static defaults with no reference,
  only in the destructured form, one binding each, an object-form parameter named with no `$$`,
  type names that are identifiers and not reserved, a local `Props` only as the props type of
  every component whose props reach it, and a prop referred to by its name or, in the object form,
  as the parameter's member.
- **Every name an output introduces** (`props`, `rawProps`, `_props`, `Props`, `cx`,
  `CSSProperties`, `Component_1`, `input`, `component$`, the framework's imports) is claimed
  around the names the source uses, so none captures another (`NameScope` and `sourceNames` in
  `@unframework/codegen`).

## Consequences

**Positive:**

- One props declaration behaves the same on seven targets, explicit `undefined` and `null`
  included (on Qwik, `null` written as an attribute), and each output keeps its framework's idiom
  (G2).
- Every divergence the probes found is either neutralised in a target or rejected at the source
  with a code and a reason.

**Negative:**

- The accepted types are narrow until M5: no imported types, no `extends`, no generics, no utility
  types, no function props.
- A nullable member cannot have a non-null default, and a prop cannot be both boolean and a string
  Vue casts. Both rules exist for one framework each.
- The reserved names and type names grow with every output's needs, and a rename is the author's.
- Until M5, the unplugin's `joinModules` cannot join two components of one file whose outputs
  declare the same name. Two script components that share a type declaration fail with "`P` is
  declared by A.tsx and B.tsx"; so do two React or Solid components that both print the inline
  `cx` helper (ADR-0038), and two imports from one framework that name different sets (Angular's
  `Component` beside `input`, Solid's `Show` beside `For`): only an identical import is written
  once. The file must be split; `packages/unplugin/README.md` records it. Vue, Svelte and Astro
  refuse a file with several components until M3.

**Open:**

- M5's type oracle can resolve imported and generic types and model value kinds exactly; it may
  then lift the boolean-and-string rule by rewriting Vue's union order.
- M3 decides the rest element (`...rest`, fallthrough).
- M5: components of one module that share a type, or an inline helper.

## Alternatives considered

- **Accept any member type and treat what the analyzer cannot read as unknown.** React throws on
  an object or a symbol child where Vue prints it, and a function prop would be a second channel
  for events and slots (P3, §4.2).
- **Neutralise Vue's casting in the Vue output**, by reordering the union so `string` comes first or
  by declaring runtime props. Types are copied as written, and a runtime declaration is not the
  idiomatic `defineProps<P>()` (G2).
- **Apply Qwik defaults with `props.x === undefined ? d : props.x`.** Not idiomatic Qwik (G2); the
  analyzer rule costs authors one `null` default.
- **Angular `input<T>(default)` without the transform.** Idiomatic, but an explicit `undefined`
  replaces the default on Angular only.
- **Angular templates that call each input (`label()`), as first planned.** Idiomatic, but a call is
  never narrowed, so `phone() && phone().length` fails L4 where the source type-checks.
- **Solid `mergeProps` with a plain or `as const` object.** The plain object widens literals, and
  `as const` makes array defaults readonly; both fail L4. `satisfies Partial<P>` for every default
  fails L4 too where a default holds an object or an array literal, as above.
- **Omit unread props on Vue as elsewhere.** `vue/require-default-prop` then fails L5, and an absent
  Boolean prop the pattern leaves out is cast to `false` again.
- **Keep an unread optional Vue prop under its own name.** typescript-eslint's `no-unused-vars`,
  which L5 runs on Vue files (ADR-0042), rejects the unused local.
- **`withDefaults` without a pattern, for every Vue component.** It changes every prop's
  declaration, its templates would read a prop named `Map` as the global, and array and object
  defaults would need factories.

## Evidence

- Vue 3.5.43 `compileScript` infers `flag?: boolean | string` as `[Boolean, String]`. With
  `= undefined`, the absent prop stays `undefined`, but `""` and `"flag"` render `true`;
  `string | boolean` keeps `""`. A prop named `ref_key` warns "Invalid prop name" and arrives as
  `undefined`. `packages/target-vue/test/render.test.ts` pins the outcome: "leaves an absent
  optional boolean undefined, and gives a default when one is absent", "gives the object form's
  absent optional boolean no value either", "takes the default for an explicit `undefined`, and
  keeps `null` as a value" and "declares props it does not read, so they never fall through to
  the root". `compileScript` accepts `export interface` in `<script setup>`: every Vue golden output
  has one, and `test/framework-compile.test.ts` compiles them without a warning.
- The Qwik optimizer (2.1.0-beta.9) compiles `({ tone = "info" })` to `p0.tone ?? "info"`; with
  `tone: null` Qwik's SSR renders the default, while React, Svelte, Solid, Vue and Astro keep
  `null`.
- Angular 22.2.1: `input<string>("info")` after `setInput("tone", undefined)` renders nothing; the
  transform form renders `info`, passes L3 with no warning and works for literal unions and readonly
  arrays (`packages/target-angular/test/output.test.ts`, and the corpus's `explicit-undefined`
  scenario below). A signal call is never narrowed: `phone() && phone().length` is TS2532 in a
  template, `phone && phone.length` through `@let` is not.
- tsgo 7.0.2: `mergeProps` with a plain defaults object types a prop whose default is
  `"anonymous"` as `string`, and binding it to `<img crossorigin>` fails with TS2322. With
  `satisfies Partial<P>` every probe type-checks, and Babel 7 (Solid's L3) accepts it;
  `packages/target-solid/test/output.test.ts` runs L3, L4 and L5 over every shape the emitter
  prints, `satisfies Partial<` among them.
- Angular's template parser fails on `{{ étiquette() }}` ("Unexpected character"), on `as()`,
  `typeof()`, `in()` and `let()`, and reads `undefined()` and `null()` as literals.
- `packages/analyzer/test/props.test.ts` holds each rule: "reports %s as invalid props (UF2001)",
  "reports a rest element as fallthrough, which lands in M3", "reports the declaration in %j",
  "reports the member %s (UF1002)", "reports %s, a string of which Vue reads as true", "accepts a
  boolean beside string literals Vue does not cast, as tri-state ARIA takes", "reports the prop name
  %s (UF2003)", "accepts `Props` as a component's own props type", "reads the default %s as static:
  %s", "accepts a null default on a nullable prop", "reports a default holding </script, which would
  end a script block" and "reports a type or a props parameter not named in ASCII".
  `packages/ir/test/names.test.ts` pins the reserved names and type names, and `invariants.test.ts`
  breaks each mirrored invariant once.
- Each target's emit tests pin its shapes (`packages/target-*/test/emit.test.ts`), among them Vue's
  "keeps every optional prop in the pattern, an unread one under a `_` local, and leaves out unread
  required ones", Svelte's "declares props it never reads under the object form, keeping the props
  type", Angular's "types an input with a default without `undefined`" and "names the class apart
  when the component is named after Angular's decorator", and Solid's "types the defaults of an
  inline props type by that type" and "types object defaults by the props' own types, which keep
  their optional members" and "types array defaults by the props' own types, not the literals they
  list"; `test/output.test.ts` type-checks the `Narrowing` source of
  `test/sources.ts`, whose `attrs = { title: "t" }` takes that form. The render-parity kit's sources
  "defaults when absent, explicitly undefined and given" and "a null default and null passed" render
  on all seven targets.
- `packages/target-vue/test/shapes.test.ts` "would fail L5 with an optional prop left out of the
  pattern" and "would fail L5 with an unread optional prop under its own name"
  (`@typescript-eslint/no-unused-vars`); `test/render.test.ts` "renders unread props whose local
  is named like Vue's own (server: %s)". The kit's source "props nothing reads, in the pattern or
  not, with and without defaults" renders on all seven targets.
- Unread names: `packages/target-react/test/emit.test.ts` (`A(_props: P)`, `A(__: P)`),
  `packages/target-solid/test/emit.test.ts` "keeps an object form %s nothing reads as %s" and
  `packages/target-svelte/test/emit.test.ts` "names an object form %s that nothing reads %s";
  `packages/target-astro/test/emit.test.ts` "exports an inline `Props`, or the source's own
  `Props`, when the markup reads no prop" and "types the callers of a component that reads no prop
  by its exported `Props` (L4)", and `test/lint.test.ts` "accepts an exported `Props` nothing
  reads, which is the component's API". The corpus cases `props/unread-props` and
  `props/unread-props-object` hold both forms.
- `packages/target-qwik/test/ssr/null-props.test.ts` "reach the component as `null` from the
  adapter, and an absent prop as `undefined`" and "keep `null` as a parent writes it, and lose it
  through a spread or `jsx()`", and `test/null-props.browser.test.ts` "reach the component as
  `null` from the adapter, on a rerender too" (`packages/target-qwik/src/toolchain/element.ts`).
- `packages/analyzer/test/analyze.test.ts` "reports a component written as a value, and declares
  it: %s", "checks a component written as a value as the declaration its fix writes" and "offers
  no rewrite of a typed or async value, nor names a lower-case one a component".
- `packages/unplugin/test/assemble.test.ts` "refuses top-level declarations and exports that
  clash".
- Each target's `props/*` golden output has the shape above and is green at L3, L4 and L5, and at
  every other live layer. `props/destructured-defaults`'s browser-only `explicit-undefined`
  scenario and `props/optional`'s null scenario pass on all seven targets.
