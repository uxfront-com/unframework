# ADR-0009: CSS is scoped with Vue's attribute algorithm

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D5; §4.3, §4.4, §4.5, §5.8, §6, §7.5, §7.6, P8, M4, Appendix A

## Context

ADR-0004 makes the compiler, not each framework, scope a component's stylesheet. It still needs an
algorithm.

- The source's semantics are Vue's wherever every target can meet them (§4.5).
- Classes are written as strings in JSX, and `class` also takes arrays and objects. Styleframe
  recipes compute classes at runtime from ordinary imports (§4.3, §4.4).
- Output must be deterministic: the same input and versions give byte-identical output (P8).
- Visual parity compares every target against one baseline at zero pixel tolerance (§7.6).

## Decision

The compiler applies Vue's attribute algorithm on every target.

- Each component gets a deterministic scope attribute, such as `data-uf-c3a1`, on the elements it
  renders, and the stylesheet's selectors are rewritten to match it.
- Vue's semantics hold for the child root, `:deep()`, `:slotted()` and `:global()`.
- The CSS scoper in `@unframework/codegen` does the rewrite with lightningcss (§5.8).
- The scope attributes are part of the contract. DOM normalisation keeps them, while it removes the
  frameworks' own (`_ngcontent-*`, `data-astro-cid-*`) (§7.5).

React's output for the Counter (Appendix A), with the class names unchanged:

```tsx
<div className="counter" data-uf-c3a1>
  <output data-uf-c3a1>{count}</output>
  {doubled > 10 ? <span data-uf-c3a1>Big</span> : null}
  <button type="button" onClick={increment} data-uf-c3a1>
    +{step}
  </button>
</div>
```

## Consequences

**Positive:**

- Class names stay as written, so classes computed at runtime, including Styleframe recipes, still
  match their selectors.
- The semantics are the ones Vue users already know, consistent with the source's Vue reference.
- One algorithm gives identical selectors on every target, which zero-tolerance visual parity
  relies on.
- The attribute is deterministic, so golden files stay stable (P8).

**Negative:**

- Every element in every output carries an extra attribute, and the golden files and DOM
  expectations include it.
- Each scoped selector gains an attribute selector, which raises its specificity, as it does in
  Vue.
- Child-root and `:slotted()` semantics have to hold on targets whose slot models differ from
  Vue's: React's children, Angular's projection, Qwik's `<Slot />`. M4's cases settle each cell.

## Alternatives considered

- **CSS Modules-style class hashing.** It renames classes, so the compiler would have to rewrite
  every class in the JSX to match. That only works for strings the compiler can see: classes
  computed at runtime, including Styleframe recipes, would miss their selectors. It would also drop
  the `:deep()` and `:slotted()` semantics the source takes from Vue.
