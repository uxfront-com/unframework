# ADR-0044: An empty `class` or `style` is no attribute, and style declarations compare as a set

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §7.5 (normalisation), §7.7, §9 M1; P2, P4; ADR-0014, ADR-0024, ADR-0038; amends
  ADR-0031

## Context

ADR-0031 lets normalisation remove only a target's own noise, rule by rule for the target that
makes it, so that a target can only pass by producing the reference's DOM. M0 kept an empty
`class=""` on purpose, kept `style=""`, and kept style declarations in their written order.

M1's class and style bindings (ADR-0038) meet differences that are not one framework's noise.
The same framework disagrees with itself, and the DOM's history decides what is left:

- **Empty class.** Vue renders `class=""` for an empty `:class` array in SSR and in the DOM, but a
  root `:class` that is `undefined` renders no attribute in SSR and `class=""` in the DOM. Svelte's
  server renders no attribute, its client `className = ""`. Astro's `class:list` renders none.
  Angular's server renders `class=""` for a false `[class.a]`, while Chromium's `classList.remove`
  on an element without a class creates nothing.
- **Empty style.** Vue's SSR always prints `style=""` for an all-nullish `:style`, its DOM prints
  nothing. React renders no attribute; Astro prints `style=""`; Qwik's SSR prints `style=""`.
- **History.** After a toggle, Chromium keeps `class=""` and `style=""`, so a rerendered DOM
  differs from a fresh mount of the same props.
- **Order.** A client appends a re-set declaration at the end of the CSSOM. Angular applies a
  static `style` before its bindings, and its style maps in sorted key order.

With M0's rules, `bindings/class-object`, `bindings/style-merge` and `semantics/reactive-props`
could not be green on all seven targets, and Vue's own client would fail against the render-parity
kit's reference evaluator.

## Decision

- **For every target, the reference included**, because the disagreement is inside each framework
  and in the DOM's history, not one framework's noise:
  - a `class` attribute with no tokens is removed;
  - a style declaration with an empty value is removed, as the CSSOM ignores it;
  - a `style` attribute with no declarations left is removed;
  - style declarations are sorted by property name, unless two of them name the same property, or
    a shorthand and one of its longhands; then their order is kept, because it decides the result.
    The longhand table lives in `normalize/style.ts`.
- **Class tokens keep their duplicates.** A doubled token means a broken merge (ADR-0038), and
  sorting tokens (§7.5) already makes their order insignificant.
- **Each rule has a negative test**: a non-empty class or style survives; declarations that overlap
  keep their order; a real difference in a value still fails.
- **The analyzer makes the sort safe.** It rejects a Style that sets a property twice or a shorthand
  with its longhand (UF3022, ADR-0038), so an authored style never depends on the order the sort
  removes. The kept-order exception is for output that breaks that rule.
- **The render-parity kit's reference evaluator** writes no attribute for an empty class or style,
  and applies the same rules to both sides.
- **Amendments to ADR-0031.** "Noise is per target" gains these target-independent rules, and its
  reading of inline styles now treats declaration order as insignificant where no two declarations
  overlap.

```text
Vue SSR      <p class="" style="">a</p>          →  <p>a</p>
Vue DOM      <p class="">a</p>                   →  <p>a</p>
Angular SSR  <p style="color: red; width: 1px">  →  <p style="color: red; width: 1px">
Svelte DOM   <p style="width: 1px; color: red">  →  <p style="color: red; width: 1px">
```

## Consequences

**Positive:**

- Class and style bindings can be green on every target, SSR and client, fresh and rerendered.
- The kit's evaluator, the shared expectations and every target agree on one rule.

**Negative:**

- An author's CSS that selects `[class]`, `[style]` or `:not([class])` could tell an empty
  attribute from none. M1 has no stylesheets; M4 must reject such selectors or record the
  difference (to verify in M4).
- A target that adds an empty `class=""` where the source has no class at all passes too. Nothing
  renders differently, but the normalised DOM no longer shows it.
- These rules apply to the reference, so they shape what `__expected__` records.

## Alternatives considered

- **Keep `class=""` and `style=""` and fix each target.** Svelte's server cannot render `class=""`
  at all (`to_class` returns `null` for `""`), and Vue's SSR and DOM disagree with each other, so
  no target-side fix exists.
- **Declare the empty-attribute difference as a capability**, unsupported on Svelte, Astro and
  Angular. It would make class bindings unusable on three targets for a difference no reader sees.
- **Make declaration order significant and emit it everywhere.** The CSSOM's append order after a
  rerender makes that impossible on every client.
- **Per-target rules, as ADR-0031 prefers.** Vue, the reference, needs the rule against itself, and
  Chromium's history affects every client.

## Evidence

- Vue 3.5.43: `:style="{ color: null }" :class="[]"` renders `<p style="" class="">` in SSR; in
  Chromium `h('p', { style: { color: null }, class: { a: false } })` renders `<p class="">`. After a
  rerender from `color: null` to `"red"` beside a static `margin`, the DOM holds
  `margin: 0px; color: red;`, CSSOM order rather than source order.
- Svelte 5.57.1: `class={[]}`, `class={{ a: false }}` and a null `style:` render no attribute in
  SSR; its client sets `className = ""`.
- Astro 7.3.5: an empty `class:list` renders no attribute, an all-nullish style `style=""`.
- Angular 22.2.1: a false `[class.a]` renders `class=""` in its server DOM; it stores `[style]` and
  `[class]` maps in a sorted key-value array and applies its static `style` first.
- React 19.3: `style={{ color: undefined }}`, `style={{}}` and `style={{ color: "" }}` render no
  attribute. Qwik's SSR renders `style=""` or `style="color:"`.
- Chromium: setting `el.style.color = ""` on a fresh element creates no attribute; after toggling,
  `class=""` and `style=""` remain.
- `packages/testing/test/normalize*.test.ts` covers each rule with its negative test
  (to verify in M1).
