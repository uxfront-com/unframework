# ADR-0006: The authoring API and JSX runtime come from `unframework`

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D2; §2, §4.1, §4.6, §5.2, §5.4, §5.6, §8.2, M6

## Context

The authoring API (`ref`, `computed`, `watch`, the `define*` macros) needs types for tsgo and
editors, and the compiler has to find every call to it reliably.

- v1's rewriter matched identifiers by name, not by scope, and glued strings together (§2).
- v1's macro discipline is worth keeping: macros recognised by binding, called at the top level,
  statically analysable, erased (§2).
- With `"jsx": "preserve"`, TypeScript transforms nothing, but it still needs a source for the JSX
  types of intrinsic elements and component attributes.
- The source must stay framework-free. Imports from `react`, `vue` or `solid-js` are diagnostics
  (§4.6).

## Decision

- The authoring API is imported from `unframework`. The package provides types plus inert stubs.
- The compiler recognises each stub by binding, not by name, and erases it. No `unframework` import
  survives into any output.
- `tsconfig` sets `"jsx": "preserve"` and `"jsxImportSource": "unframework"`. The
  `unframework/jsx-runtime` types follow ADR-0017.
- The `unframework` root export is types and stubs only (§5.2, ADR-0016).

```tsx
import { computed, defineEmits, ref } from "unframework";
```

```jsonc
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "unframework",
  },
}
```

## Consequences

**Positive:**

- Recognition by binding goes through real scope analysis (§5.4), so a local function that happens
  to be called `ref`, or a parameter that shadows one, is never mistaken for the API.
- The API behaves like any import: auto-import, go-to-definition and types work in every editor.
- Outputs import only their framework (ADR-0015).
- Every framework import is a diagnostic, so the source is visibly framework-free. M0's
  `diagnostics/framework-import-rejected` case pins this.

**Negative:**

- The stubs are inert. A `.uf.tsx` file type-checks without the compiler, but it does nothing
  useful if run directly.
- A host app has to set `jsxImportSource: "unframework"` for `.uf.tsx` files only, through a
  scoped tsconfig or the per-file pragma. M6 settles which (§8.2).
- `unframework`'s JSX types must accept every legitimate consumer use of macro-declared events,
  models and slots without false errors (ADR-0003, layer 1), which constrains their design.

## Alternatives considered

- **Macros as globals, with no import.** The compiler would have to recognise them by name, which
  is the fragility v1's name-based rewriting showed (§2). Recognition by binding needs a binding to
  resolve, and an import provides it.
