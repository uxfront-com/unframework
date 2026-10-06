# ADR-0044: An empty `class` or `style` is no attribute, and style declarations compare as a set

- **Status:** Accepted
- **Date:** 2026-10-05
- **Plan:** §7.5 (normalisation), §7.7, §9 M1; P2, P4; ADR-0014, ADR-0019, ADR-0024, ADR-0029,
  ADR-0038; amends ADR-0031

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
- **Empty style.** Vue's SSR always prints `style=""` for an all-nullish `:style`, and `color:;`
  for an empty bound value, where its DOM prints nothing. React renders no attribute; Astro prints
  `style=""`; Qwik's SSR prints `style=""`.
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
  - a `class` attribute with no tokens is removed (rule 4c, `canonicalizeClasses` in
    `packages/testing/src/normalize/rules/ordering.ts`);
  - a style declaration with an empty value is removed, as the CSSOM ignores it, and so is an
    empty `!important` one (rule 4a, `canonicalizeStyles` in `normalize/rules/values.ts`);
  - a `style` attribute with no declarations left is removed;
  - style declarations are sorted by property name, unless the order of two of them decides what
    renders; then the whole list keeps its order. An overridden declaration is kept in its place,
    because only the browser knows whether the later value is valid. The result is written as the
    CSSOM serialises it (`color: red; width: 1px;`).
- **One function decides when order matters**: `cssPropertiesOverlap` in `@unframework/ir`. Two
  declarations overlap when they set the same property, a shorthand and one of its longhands, two
  shorthands that share a longhand, `all` and anything but `direction`, `unicode-bidi` and custom
  properties, or a flow-relative longhand and a physical one that the writing mode can make the
  same (`margin-inline-start` and `margin-left`). The shorthand table is `CSS_SHORTHANDS`, taken
  from Chromium 153's CSSOM. The normaliser's sort, the analyzer's UF3022 and the IR's invariants
  read this one answer.
- **Class tokens keep their duplicates.** A doubled token means a broken merge (ADR-0038), and
  sorting tokens (§7.5) already makes their order insignificant.
- **Each rule has a negative test**: a class with a token survives; a declaration with a value
  survives; overlapping declarations keep their order; a real difference in a value still fails.
- **The analyzer makes the sort safe.** It rejects a Style that sets a property twice, or two
  declarations that overlap (UF3022, ADR-0038), so an authored style never depends on the order the
  sort removes. The kept-order exception is for output that breaks that rule.
- **The render-parity kit applies the same rules to both sides.** Its reference evaluator
  (`packages/codegen/test/render-parity-reference.ts`) writes no attribute for an empty class or
  style, and `comparableValue` (`render-parity.ts`) compares class and style as the normaliser does.
- **Amendments to ADR-0031.** "Noise is per target" gains these target-independent rules, and its
  reading of inline styles now treats declaration order as insignificant where no two declarations
  overlap.

```text
Vue SSR      <p class="" style="">a</p>              →  <p>a</p>
Vue DOM      <p class="">a</p>                       →  <p>a</p>
Angular SSR  <p style="color: red; width: 1px">      →  <p style="color: red; width: 1px;">
Svelte DOM   <p style="width: 1px; color: red">      →  <p style="color: red; width: 1px;">
Svelte DOM   <p style="margin-top: 1px; margin: 0">  →  the same order: the two overlap
```

## Consequences

**Positive:**

- Class and style bindings are green on every target, SSR and client, fresh and rerendered.
- The kit's evaluator, the shared expectations, the analyzer and every target agree on one rule.

**Negative:**

- An author's CSS that selects `[class]`, `[style]` or `:not([class])` could tell an empty
  attribute from none. M1 has no stylesheets.
- A target that adds an empty `class=""` where the source has no class at all passes too. Nothing
  renders differently, but the normalised DOM no longer shows it.
- These rules apply to the reference, so they shape what `__expected__` records.

**Open:**

- M4 brings stylesheets: it must reject selectors that tell an empty `class` or `style` from none,
  or record the difference.

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
- **A longhand table of the normaliser's own.** The first plan kept one in `normalize/style.ts`.
  It would drift from the analyzer's UF3022, and a pair the two read differently would either be
  rejected for nothing or be sorted when its order matters.

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
- `packages/testing/test/normalize.style.browser.test.ts` pins the Chromium facts the rules rest
  on: "ignores a declaration with an empty value", "keeps an empty class once the last token is
  toggled off", and "serialises overlapping declarations as what they resolve to, so their order
  shows".
- `packages/testing/test/normalize.rules.test.ts` holds each rule with its negative test: "removes
  a class with no token, which applies no class" beside "does not erase a class with a token" and
  "does not erase a different or a duplicated class"; "removes a style with %s, which declares
  nothing" and the "an empty value, dropped" case beside "does not erase a declaration with a value,
  or a chunk without a colon"; "sorts declarations whose order cannot change what renders" beside
  "keeps declaration order, which shorthands make significant" and "keeps the order of %s, and
  every other declaration's"; and the `cssPropertiesOverlap` pairs the sort relies on, both ways
  round, with the pairs that do not overlap. `packages/codegen/test/render-parity.test.ts`
  ("comparableValue") holds the kit's side.
- The M1 corpus is green at L6 and L7 on all seven targets with these rules, including the empty
  scenarios of `bindings/class-object` (`all-off`), `bindings/class-string` (`empty-tone`) and
  `bindings/style-merge` (`nullish-dropped`), and the rerenders of `semantics/reactive-props`.

## Addendum: text runs in L10, Qwik's `"true"`, and table-internal boxes

M1's first corpus run failed two more cells for reasons that are a framework's noise, not the
component's, and its final review found a gap in the whitespace rule. None changes the rules
above.

### L10 captures each run of text as one node

- **Context.** React, Solid and Qwik write `Price: {price} EUR` as three DOM text nodes, where Vue
  writes one, and Vue splits a text branch from the text beside it. L7 already serialises a run as
  one text. Chromium lays out each text node's width in 1/64 px units and starts the next node at
  the rounded edge, so the glyphs after a split shift by a fraction of a pixel and rasterise
  differently. In the first M1 corpus run, React, Solid and Qwik failed L10 against Vue's capture
  wherever text sat beside an interpolation (`props/primitives` differed by a pixel in width). The
  split is the framework's: no emitter can avoid it idiomatically.
- **Decision.** L10 captures geometry and pixels with every run of adjacent text nodes merged into
  the run's first node (`mergeTextRuns` and `withMergedTextRuns` in
  `packages/testing/src/browser/text-runs.ts`, around `ufVisualCapture` in `visual.ts`). Text nodes
  separated only by comments (framework anchors) are one run. A run never crosses an element, so
  white-space processing, which works on an element's text whatever its nodes, is unchanged.
  `script`, `style` and `textarea` are left alone. The capture restores the tree exactly, the same
  node objects in their places, before anything else runs: L11, the spec's assertions, a rerender.
  The rule applies to every target, the reference included, and adds no pixel tolerance. Emitters
  are not changed to avoid splitting text.
- **Evidence.** `packages/testing/test/parity/cases/stub/text-runs/text-runs.parity.spec.ts`:
  - "the same text split over nodes is wider by 1/64 px a split, and some glyphs move":
    `"Price: "` + `"12"` + `" EUR"` as three nodes lays out 1/64 px wider than as one (100.453125
    px against 100.4375 px when measured), and the pixels differ; with comments between the nodes
    the pixels are those of the split, so the split
    is the cause; in a 123 px paragraph the line breaks are the same and the pixels still differ;
  - a split run, with or without anchors, captures exactly as one node does;
  - white space that renders differently is still told apart, in the `normal`, `pre`,
    `pre-wrap`, `pre-line`, `nowrap` and `break-spaces` modes;
  - runs merge across comments, never across elements, and the same nodes come back.

  `packages/target-react/test/rerender.browser.test.ts` ("rerenders text a capture merged and
  restored") proves React still updates the text node it holds after a capture. With the rule, a
  fresh run of every `browser:` project passed all 203 L10 cells.

### On Qwik, `"true"` on a boolean attribute is presence

- **Context.** Qwik 2.0 beta's client writes a boolean attribute that is on as `name="true"`, a
  static one through `setAttribute(name, true)` and a bound one too, except the few whose DOM
  property has the same lower-case name; its server writes `name=""`. Rule 4b writes every HTML
  boolean attribute as `name=""` only when its value is empty or its own name, because any other
  value, such as `disabled="false"`, is invalid HTML that still switches the state on.
- **Decision.** On the Qwik target only (ADR-0031: noise is per target), rule 4b
  (`canonicalizeBooleanAttributes` in `normalize/rules/values.ts`) also reads `"true"` on an HTML
  element's boolean attribute as presence. The IR only ever turns a boolean attribute on with
  `true`, so on Qwik `"true"` means exactly that. Every other value, and `"true"` from every other
  target, stays as written.
- **Evidence.** `normalize.rules.test.ts`: "writes Qwik's %s as an empty value", for
  `disabled="true"`, `readonly="TRUE"`, `<details open="true">` and `<div hidden="true">`, each
  equal to Vue's empty spelling; and 'keeps "true" from every other target, and "false" and
  until-found from Qwik', which also keeps `open="true"` on a `<div>` and `hidden="true"` in SVG,
  where they are not HTML boolean attributes.

### The whitespace rule models table-internal boxes and ruby annotations

- **Context.** ADR-0031 left table-internal `display` values set inline "not modelled yet (M1)",
  and the whitespace rule treated a cell or a row as a plain block. M0 had no `style`, so only
  the user-agent's table elements reached that code. M1 binds `display`: the analyzer rejects a
  static table-internal value (UF1002), but a bound one reaches the DOM. In Chromium a
  `display: table-cell` inside an inline box is wrapped in an anonymous inline table, an atomic
  inline, so the spaces around it render: `a <span style="display: table-cell">b</span> c` lays
  out wider than the same markup without them, which the rule had called equal.
- **Decision** (amends ADR-0031's whitespace bullet). Each box knows whether it is
  table-internal, by its inline `display` or the user-agent default (`Box.tableInternal` in
  `packages/testing/src/normalize/display.ts`). A table-internal box whose parent is an inline box
  sits in an anonymous inline table, which Chromium builds with whitespace rules of its own; the
  rule does not model them, so every whitespace of that line, and of the box's own content, is
  kept as written, a loud difference rather than a hidden one. In a block container the anonymous
  table is block-level, a block. A table-internal box that floats, is absolutely positioned or is
  blockified by a flex or grid container is a block container, in no anonymous table. A ruby
  annotation's end hides a zero-width space from a line break beyond it; its start does only
  where its parent box is no ruby container (`display: ruby`, `inline ruby` or `block ruby`,
  through `display: contents`), as Chromium wraps such an annotation in an anonymous ruby
  (`opaqueStart`, `opaqueEnd`). A `block ruby` inside a ruby becomes an inline ruby, not an
  inline-block.
- **Evidence.** `packages/testing/test/normalize.whitespace.test.ts`: "keeps the line of a
  table-internal box in an inline box as written", "lays a table-internal box in a block container
  out as a block", "blockifies a table-internal box into a block container" and "removes a line
  break after a zero-width space across an annotation's start", "keeps the start of an annotation
  outside a ruby container an item of its own" and "inlinifies a block ruby in a ruby as an inline
  ruby, not an inline-block".
  `normalize.whitespace.browser.test.ts` measures each pair in Chromium, among them "spaces around a
  table cell in an inline box, an anonymous inline table, and none", "spaces around a table cell in
  a block container, an anonymous block-level table" and "a space between inlines in a table row a
  flex container blockifies, and none".
