# ADR-0016: `unframework` plus `@unframework/*`

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D12; §3 (G6), §4.1, §5.2, §8.1, §8.3

## Context

- Authors import the authoring API in every component and name it in `jsxImportSource`
  (ADR-0006).
- Users also need `defineConfig` (§8.1) and a CLI (§8.3).
- The compiler is many small packages with one job each, usable on their own (G6, §5.2).

## Decision

`unframework` is the umbrella package. It holds:

- the authoring API and the `unframework/jsx-runtime` types, with a root export of types and stubs
  only
- `defineConfig`, from `unframework/config`
- the `unframework` bin
- tooling re-exported under subpaths, lazy-loaded

Everything else is scoped under `@unframework/*`:

- the compiler: `parser`, `ir`, `diagnostics`, `type-oracle`, `type-oracle-tsgo`, `analyzer`,
  `codegen`, `target-<name>` and `compiler`
- the tooling: `unplugin`, `cli`, `language-tools`, `testing`, `visual` and `mcp`

The scaffolder is `create-unframework` (M6).

```tsx
import { computed, defineEmits, ref } from "unframework";
```

```ts
import { defineConfig } from "unframework/config";
```

## Consequences

**Positive:**

- The import that appears in every component, and the JSX import source, are short and read as the
  product's name.
- Authors install one package, and its bin matches the name: `unframework build`.
- Scoped packages keep the internal pieces separate and reusable on their own (G6).

**Negative:**

- `unframework` mixes the authoring API with tooling. Its root export has to stay types and stubs
  only, and its tooling lazy-loaded, so that importing the API never pulls in the compiler.
- There are two naming styles to explain: the unscoped `unframework` and `create-unframework`, and
  the `@unframework` scope.
- The name `unframework` belongs to `packages/unframework`, so the repo root's private
  `package.json` is `unframework-monorepo`: tooling that selects workspace packages by name must
  never confuse the two.

## Alternatives considered

- **Everything scoped.** The authoring import and the JSX import source would carry the scope in
  every component and every tsconfig. The plan gives no further reason for preferring the unscoped
  umbrella.
