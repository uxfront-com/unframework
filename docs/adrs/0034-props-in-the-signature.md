# ADR-0034: Props are a typed signature parameter with local types and static defaults

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §4.1, §4.2, §6 (signature props), §9 M1; P2, P3, P4, P6; R5, R6; ADR-0001, ADR-0007,
  ADR-0033

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
- **Solid's `mergeProps` widens literal defaults** (`"info"` becomes `string`), which fails L4 in a
  typed position such as `crossorigin`.
- **Names collide with each output's own syntax:** Angular's lexer is ASCII-only and reads `as`,
  `typeof` or `undefined` as keywords; Astro's `const { Astro } = Astro.props` is a temporal dead
  zone error; Vue reserves `ref_key` and `ref_for`.

## Decision

- **Forms.** The first and only parameter is the props:
  - destructured: shorthand identifiers, each with an optional default (`{ a, b = 1 }`). Renames,
    nested patterns and computed keys are UF2001; a rest element is fallthrough, UF1002 until M3;
  - object: an identifier, only when no member needs a default. Every use is a non-computed member
    read `props.x` of a declared member; any other use is UF2001.
- **The annotation is required** (UF2001). It is an inline object type literal, a local `interface`
  (no `extends`, no type parameters, not declared twice), or a local `type` alias of an object type
  literal or of another local reference. Anything else is UF1002, "lands in M5".
- **Member types are a closed set:** `string`, `number`, `boolean`, `null`, `undefined`, literal
  types, unions of these, arrays (`T[]`, `readonly T[]`, `Array<T>`, `ReadonlyArray<T>`), object
  type literals and local interfaces and aliases, followed lazily. UF1002 otherwise:
  - a function type anywhere: callbacks are events (M2), render functions are slots (M3);
  - `any`, `unknown`, `object`, `{}`, `symbol`, `bigint`, utility, template literal, tuple, enum,
    imported and global types: M5;
  - a union that holds both a boolean and a string type: Vue's casting, below.
- **Names** match `/^[A-Za-z][A-Za-z0-9]*$/`, because Angular's lexer is ASCII-only, and are not
  reserved (UF2003). `RESERVED_PROP_NAMES` in `@unframework/ir` holds:
  - the names JSX and the frameworks give meaning to: `key`, `ref`, `children`, `class`, `style`,
    `slot`, `is`, Vue's `ref_for` and `ref_key`, and `constructor` (Solid's `mergeProps` skips it);
  - the names the outputs use: `props`, `rawProps` and `Astro`;
  - every strict-mode reserved word, `arguments` and `eval`, Angular's expression keywords (`as`,
    `let`, `typeof`, `in`, `undefined`, …) and every allowed global (ADR-0035);
  - the patterns `/^on[A-Z]/` (events, M2), `/^ng[A-Z]/` (Angular) and a trailing `$` (Qwik).

  A local type named `Props` that is not a component's props type, or one named `CSSProperties`, is
  UF2003 too: the Astro and React outputs declare those names.

- **Defaults are static** (UF2002): string, number, boolean and `null` literals, negated numbers,
  template literals without expressions, and arrays and objects of those. A default on a required
  member is UF2001. A default on a member whose type admits `null` is UF2001 unless it is `null`
  (Qwik's `??`). A string default holding `</script` is UF1002 (ADR-0041).
- **Absent and `undefined` are the same** on every target: the prop takes its default or stays
  `undefined`. `null` is a value.
- **Type declarations are copied.** `UfModule.types` holds each top-level `interface` or `type` the
  props reach, as the exact source text, and each output declares its component's closure, exported
  as in the source. A declaration no props reach is UF1002 (shared types, M5), and so are
  `import type` from anywhere but `unframework` and a declaration that could end a script block
  (ADR-0041).
- **Each target maps props its own way** (refining plan §6's row), and the capability `props` is
  native on all seven. Every target omits a destructured prop that no printed expression reads, so
  L5's unused-variable rules hold (ADR-0042).

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
React    function Badge({ label, tone = "info", count }: BadgeProps)
Vue      const { label, tone = "info", count = undefined } = defineProps<BadgeProps>();
Svelte   let { label, tone = "info", count }: BadgeProps = $props();
Solid    const props = mergeProps({ tone: "info" } satisfies Partial<BadgeProps>, rawProps);
Angular  readonly tone = input<"info" | "warn", "info" | "warn" | undefined>("info", {
           transform: (value) => (value === undefined ? "info" : value),
         });
Qwik     component$<BadgeProps>(({ label, tone = "info", count }) => …)
Astro    type Props = BadgeProps;  const { label, tone = "info", count } = Astro.props;
```

- **Vue** gives every optional prop without a default `= undefined` (the object form:
  `withDefaults(defineProps<P>(), { count: undefined })`). That stops the absent-Boolean cast and
  satisfies `vue/require-default-prop`. Rejecting boolean-and-string unions stops the other two.
- **Angular** reads every input as a signal call (`label()`). A required prop is
  `input.required<T>()`, an optional one without a default `input<T | undefined>()`, and one with a
  default always takes the transform above: `value === undefined`, never `??`, because `null` is a
  value.
- **Solid** never destructures: every prop reference becomes `props.x`, and the defaults are typed
  with `satisfies Partial<P>` (`Partial<{…}>` for an inline literal).

## Consequences

**Positive:**

- One props declaration behaves the same on seven targets, explicit `undefined` and `null`
  included, and each output keeps its framework's idiom (G2).
- Every divergence the probes found is either neutralised in a target or rejected at the source
  with a code and a reason.

**Negative:**

- The accepted types are narrow until M5: no imported types, no `extends`, no generics, no utility
  types, no function props.
- A nullable member cannot have a non-null default, and a prop cannot be both boolean and string.
  Both rules exist for one framework each.
- Until M5, two script components in one file that share a type declaration fail the unplugin's
  `joinModules` ("declared by A and B"); the file must be split. The unplugin README records it.

**Open:**

- M5's type oracle can resolve imported and generic types and model value kinds exactly; it may
  then lift the boolean-and-string rule by rewriting Vue's union order.
- M3 decides the rest element (`...rest`, fallthrough).

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
- **Solid `mergeProps` with a plain or `as const` object.** The plain object widens literals, and
  `as const` makes array defaults readonly; both fail L4.

## Evidence

- Vue 3.5.43 `compileScript` infers `flag?: boolean | string` as `[Boolean, String]`. With
  `= undefined`, the absent prop stays `undefined`, but `""` and `"flag"` render `true`;
  `string | boolean` keeps `""`. `compileScript` accepts `export interface` in `<script setup>`.
  A prop named `ref_key` warns "Invalid prop name" and arrives as `undefined`.
- The Qwik optimizer (2.1.0-beta.9) compiles `({ tone = "info" })` to `p0.tone ?? "info"`; with
  `tone: null` Qwik's SSR renders the default, while React, Svelte, Solid, Vue and Astro keep
  `null`.
- Angular 22.2.1: `input<string>("info")` after `setInput("tone", undefined)` renders nothing; the
  transform form renders `info`, passes L3 with no warning and works for literal unions and readonly
  arrays.
- tsgo 7.0.2: `mergeProps` with a plain defaults object types a prop whose default is
  `"anonymous"` as `string`, and binding it to `<img crossorigin>` fails with TS2322. With
  `satisfies Partial<P>` every probe type-checks, and Babel 7 (Solid's L3) accepts it.
- Angular's template parser fails on `{{ étiquette() }}` ("Unexpected character"), on `as()`,
  `typeof()`, `in()` and `let()`, and reads `undefined()` and `null()` as literals.
- Each target's `props/*` golden output has the shape above and is green at L3, L4 and L5
  (to verify in M1).
