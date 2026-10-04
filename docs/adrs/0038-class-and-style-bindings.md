# ADR-0038: `class` binds a set of tokens, and `style` binds declarations that never overlap

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §4.3, §4.4, §6 (`class={[…]}`), §9 M1, M4; G2, P2, P4, P7; ADR-0015, ADR-0037;
  amends ADR-0032

## Context

Plan §4.3 gives `class` a string, array or object form and `style` an object or a string, and §9
puts "`class` and `style` in every form" in M1. ADR-0032 left static `style` as the React target's
own UF1002 "until M4's style attribute kind makes it an invariant". Every framework merges and
orders class and style differently, and probes found the obvious mappings broken:

- **Class.** Svelte's `class:name` directive and Angular's `[class.name]` remove a token that a
  dynamic class string produces, instead of joining it. Angular's `[class.w-1.5]` loses the text
  after the dot, its `[class]` array drops entries that hold a space, and it renders a repeated
  token once where the others render it twice. React's `className` takes only a string.
- **Style.** Svelte renders `style={{…}}` as `[object Object]`. Svelte and Angular apply a static
  `style` before the bound declarations, whatever the source order, so a shorthand and its longhand
  override each other differently. Qwik adds `px` to numbers on properties React treats as unitless
  (`strokeWidth`). Solid wants kebab-case keys.
- **Empty values** render differently even within one framework (ADR-0044).

## Decision

- **`class`.** `class="a b"` stays Static. `class={…}` becomes a **Class** attribute of items:
  - a string literal is a Static item; an expression whose kinds are within string, nullish and
    unknown is a Dynamic item, its whitespace-separated tokens;
  - an array literal contributes its elements, recursively; `cond && "a b"` is one Toggle per name;
    `cond ? "a" : "b"` is Dynamic; `false`, `null` and `undefined` elements are dropped;
  - an object literal is one Toggle per name per key (computed keys and spreads: UF3022);
  - `cond && expr` with a non-literal `expr` is UF3018 with a safe fix to `cond ? expr : undefined`;
    number and boolean kinds in a Dynamic position are UF3018;
  - a Class whose items are all Static is UF3004 with a safe fix to `class="a b"` (P3), and two
    Static or Toggle items with the same name are UF3007.
- **Class semantics.** The rendered tokens are the union of the Static names, the true Toggles and
  the Dynamic tokens; a nullish or `""` Dynamic value adds none. Order and spacing do not matter,
  and a class with no tokens is the same as no `class` attribute (ADR-0044). A Dynamic token that
  repeats another item's name at run time is outside the contract (ADR-0035), because Angular
  renders it once.
- **`style`.** Every `style` becomes a **Style** attribute of declarations, so ADR-0032's static
  `style` exception ends:
  - `style="color: red; margin-top: 4px"` is parsed with lightningcss into Static declarations
    (property in lower case, value as written, trimmed); a parse error or no declaration is UF3022;
  - `style={{ color: "red", marginTop: gap, "--gap": size }}`: keys are camelCase standard
    properties or quoted custom properties. A kebab-case standard key is UF3004 with a safe fix to
    camelCase; vendor prefixes are UF1002; computed keys, spreads and methods are UF3022. String
    literal values are Static, other values Bound;
  - one Style that sets a property twice, or a shorthand with one of its longhands (lightningcss
    knows the sets), is UF3022: object-based targets cannot express it, and order would then
    matter. So is `!important`;
  - a number is accepted only on `UNITLESS_PROPERTIES` (`@unframework/ir`: the standard properties
    both React and Qwik treat as unitless) and on custom properties; elsewhere it is UF3018, with a
    likely fix to `"<n>px"` for a literal. A boolean kind is UF3018.
- **Style semantics.** A Bound declaration whose value is nullish or `""` is left out, and the
  others render. Their order does not matter, because no two overlap, and a style with no
  declarations is the same as no `style` attribute (ADR-0044).
- **Each target writes its own form** (plan §6):
  - React: `className="…"` when static, otherwise `className={cx(…)}` with an inline `cx` helper
    printed after the component (`class-binding: emulated`, ADR-0015); style objects, with
    `as CSSProperties` when a custom property is present;
  - Vue: `class="…"` beside `:class="[…]"`, and `:style` or a static `style`;
  - Svelte: one `class={[…]}` (clsx), never `class:` directives; a static `style="…"` only when
    every declaration is Static, otherwise every declaration as a `style:` directive in source
    order;
  - Solid: an inline helper or `class` plus `classList` where it renders identically (emulated; the
    Solid lane names the helper), and style objects with kebab-case keys;
  - Angular: static `class="…"`, then one `[class]` object of Toggles or, with a Dynamic item, one
    `[class]` string expression; never `[class.name]` and never arrays. A static `style` beside
    `[style.prop]` bindings;
  - Qwik: `class={[…]}` with Toggles as object entries, and style objects;
  - Astro: `class:list={[…]}` and `style={{…}}`.
- **Deferred to M4**, each UF1002 with its milestone: `style={expr}` that is not an object literal
  (a style string or object from a prop); class arrays and objects that come from bindings (a prop
  typed `string[]`); vendor-prefixed keys; and a `display` value that makes a table-internal box,
  which the normaliser does not model (ADR-0031). The plan's "every form" for M1 is narrowed to
  the literal forms above.
- **Amendments to ADR-0032.** There is no Static `style` attribute in the IR: every `style` is a
  Style, whose properties are lower case or custom and never repeat or overlap. Class items are
  canonical: Static values have single spaces, Toggle names are single tokens, and Static and
  Toggle names do not repeat.

```text
Source   <p class={["badge", tone, { active: isActive }]}>          tone: string
React    <p className={cx("badge", tone, { active: isActive })}>
Vue      <p class="badge" :class="[tone, { active: isActive }]">
Svelte   <p class={["badge", tone, { active: isActive }]}>
Angular  <p class="badge" [class]="tone() + (isActive() ? ' active' : '')">

Source   <p style={{ marginTop: gap, color: "red" }}>
Svelte   <p style:margin-top={gap} style:color="red">
Solid    <p style={{ "margin-top": props.gap, color: "red" }}>
```

## Consequences

**Positive:**

- Class and style render the same tokens and declarations on seven targets, from SSR and from the
  client, including after a rerender (ADR-0043).
- Each target uses its own idiom; only React, and Solid if its lane needs one, carry a helper.

**Negative:**

- The M1 forms are narrower than plan §4.3: no style strings or objects from props, no class
  arrays from props, no shorthand beside its longhand, no `!important`.
- Authors cannot rely on a class token appearing twice, or on declaration order for the cascade
  inside one `style`.
- `UNITLESS_PROPERTIES` is the intersection of two frameworks' lists, so `strokeWidth: 2` needs
  `"2"`.

**Open:**

- M4 lands the deferred forms with stylesheets, scoped CSS and computed-style parity.
- Whether Solid's lane uses a helper or `classList` is settled by its golden files
  (to verify in M1).

## Alternatives considered

- **Svelte `class:` and Angular `[class.name]` for Toggles.** The idiomatic spelling of a toggle,
  but each removes a token a Dynamic item produced, and Angular's breaks on names with a dot.
- **Keep declaration order significant and print declarations in source order everywhere.** Svelte
  and Angular apply a static `style` first, and every client appends a re-set declaration at the
  end of the CSSOM, so no target can keep source order after a rerender.
- **React's unitless list.** Qwik then renders `stroke-width:2px` and `fill-opacity:2px`, which the
  normaliser cannot equate with React's output.
- **One class string for every target.** Correct, but not idiomatic on Vue, Svelte, Qwik or Astro,
  whose class arrays are their native merge (G2).

## Evidence

- Svelte 5.57.1: `<p class={c} class:b={on}>` with `c = "b x"` and `on` false renders `class="x"`.
  Angular 22.2.1: `<p [class]="c()" [class.b]="on()">` renders `class="x"`; `[class.w-1.5]` renders
  `w-1`; `[class]="[c(), 'z']"` with `c = "a b"` renders only `z`; `class="a" [class]="'a'"` renders
  `a` once. Vue's `:class="[c, { b: on }]"` renders `b x`, and Astro's `class:list` keeps repeated
  tokens.
- Svelte `style="margin-top: 4px" style:margin={m}` renders `margin-top: 4px; margin: 0;`, and
  directives alone keep their written order. Angular applies its static `style` first and keeps
  `[style.*]` bindings in template order. Svelte drops a static declaration that a nullish
  directive also names.
- Qwik's unitless set lacks React's `strokeWidth`, `fillOpacity`, `strokeOpacity`,
  `strokeDasharray` and others: `strokeWidth: 2` renders `stroke-width:2px` where Vue and React
  render `stroke-width:2`.
- tsgo: React custom properties type-check only with `as CSSProperties`; Qwik's class array
  `["a", n && "b"]` with a number `n` fails TS2322, so Toggles print as object entries.
- The `bindings/class-*` and `bindings/style-*` cases are green at every live layer on all seven
  targets (to verify in M1).
