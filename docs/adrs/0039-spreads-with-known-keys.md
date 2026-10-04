# ADR-0039: An attribute spread renders exactly the keys its type declares

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §4.3, §6 (fallthrough), §9 M1, M3; P2, P3, P4, P6; R5; ADR-0010, ADR-0034, ADR-0037,
  ADR-0038

## Context

Plan §4.3 lets `{...object}` spread attributes onto an element. Angular has no attribute spread
(§6, R5), and fallthrough, the spread of undeclared attributes, is M3's. M1 needs spreads whose
keys the compiler can see, and probes showed that even those render differently:

- **TypeScript types are open.** A value of type `{ id?: string }` can carry `title`, `onclick` or
  `style` at run time. `v-bind` and `{...x}` render every own key on six targets; Angular can only
  bind the keys it knows. An extra key also skips every name check (P2).
- **`class` does not merge.** On Qwik and Solid a spread `class` replaces the element's class.
  Astro renders a spread `class` next to `class:list` as two `class` attributes.
- **Some keys are not attributes.** A `key` spread renders `key="k"` on Solid, becomes the vnode key
  on Vue and is dropped on Qwik and React; a `children` key replaces the content on React and Solid.
- **vue-tsc rejects `v-bind`** of an object whose keys are all `data-*` (TS2559).

## Decision

- **A spread is accepted only when its keys are known.** `{...expr}` lowers to a **Spread** when
  the analyzer resolves `expr` to an object type with declared keys: a prop or a loop item typed by
  an object type literal or a local interface or alias (ADR-0034). The source may be optional
  (`attrs?: Attrs`); every key then reads through `?.`. Any other source is UF1002, "spreads of
  objects whose keys the compiler cannot see land with fallthrough (M3)". An object literal
  spread is UF3004, with a safe fix that writes the attributes out (P3).
- **A spread renders exactly its declared keys, on every target.** `SpreadAttribute.keys` lists
  them, each with the span of its member in the type. Keys a value carries beyond its type are not
  rendered; passing them is outside the contract (ADR-0035).
- **Every key is checked as a written Bound attribute** on that element (ADR-0037): its name, and
  its member type's kinds against the attribute. A key that is also written, or in two spreads, is
  UF3007. A `style` key is UF1002 (M4). `key`, `ref`, `children` and the reserved prop names are
  UF1002 (M3).
- **A `class` key merges** into the element's class: one Static or Class `class` may coexist with
  one spread `class` key, and the rendered tokens are their union (ADR-0038). The IR's "set once"
  invariant (ADR-0032) carries this one exception.
- **Every target expands the spread per declared key**, so the capability `attribute-spread` is
  native on all seven, and no target prints a native object spread:
  - React, Solid and Qwik write one prop per key (`id={attrs.id}`, `id={props.attrs?.id}`), with
    the `class` key inside the element's single class expression;
  - Vue writes one `:key-name` binding per key, Svelte and Astro one attribute per key, with the
    `class` key inside `:class`, `class={[…]}` or `class:list`;
  - Angular writes one `[attr.key-name]` binding per key.

```tsx
interface Attrs {
  id?: string;
  title?: string;
  class?: string;
}

export default function Tag({ attrs }: { attrs?: Attrs }) {
  return (
    <span class="tag" {...attrs}>
      tag
    </span>
  );
}
```

```text
React    <span id={attrs?.id} title={attrs?.title} className={cx("tag", attrs?.class)}>
Vue      <span class="tag" :class="attrs?.class" :id="attrs?.id" :title="attrs?.title">
Angular  <span class="tag" [class]="…" [attr.id]="attrs()?.id" [attr.title]="attrs()?.title">
```

## Consequences

**Positive:**

- A spread means the same on seven targets, Angular included, and every rendered key has passed the
  same checks as a written attribute.
- The `class` merge is the one place a spread meets a written attribute, and it is a union
  everywhere.

**Negative:**

- A spread is not a pass-through: a consumer who passes extra keys sees them dropped, silently at
  run time. The type is the contract.
- Spreads of objects from setup code, of `Record<string, string>` or of imported types wait for M2,
  M3 and M5.
- Outputs are longer than a native spread, one binding per key.

**Open:**

- M3's fallthrough decides how undeclared attributes reach the root, including Angular's helper
  directive (ADR-0010).

## Alternatives considered

- **Native spreads on six targets, with Angular emulated and extra keys outside the contract.**
  Idiomatic where it works, but an extra key would skip the name checks and render on six targets
  only, and the `class` merge would still need per-target work on Qwik, Solid and Astro.
- **An inline helper that picks the declared keys** (`attribute-spread: emulated`). It renders the
  same set, but adds a helper to six targets for something the compiler can expand statically
  (P7).
- **Reject spreads until M3.** Plan §9 puts spreads in M1, and typed attribute objects are common
  in design-system components.

## Evidence

- Astro 7.3.5 renders `<p class:list={["a", attrs.class]} {...attrs}>` with
  `attrs = { id: "i", class: "b" }` as `<p class="a b" id="i" class="b">`, and the normaliser
  rejects the duplicate attribute. Qwik renders `<div class="a" {...{ class: s }}>` as `class="z"`
  for `s = "z"`, and Solid replaces the class the same way. Svelte merges when the class is written
  after the spread.
- Solid's server renders a spread `key` as an attribute, Vue's `v-bind` takes it as the vnode key,
  Qwik drops it, and React drops it with a warning.
- vue-tsc rejects `v-bind="attrs"` with TS2559 when every key of `attrs` is `data-*`, even with
  `dataAttributes: ["data-*"]`; per-key `:data-x` bindings pass.
- `bindings/spreads` and `bindings/class-merge` are green at every live layer on all seven targets
  (to verify in M1).
