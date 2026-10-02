# ADR-0005: Components are `.uf.tsx`, composables are `.uf.ts`

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D1; §4.1, §5.6, §8.2, §8.6, §9 (M0 spikes 4 and 6, M5, M6), R3, R12

## Context

Three kinds of source file sit side by side in an Unframework project, and the tooling has to tell
them apart from each other and from a host app's own files.

- Components are compiled to seven targets.
- Composables, logic shared between components, are compiled per target too (M5).
- Plain modules are framework-agnostic and need no compiling.
- The bundler plugin (§8.2) and the content mapper (§5.6) both need a stable way to find
  Unframework components, including inside a host app that has its own `.tsx` files.
- v1 used an `.ink.tsx` infix (Appendix B).

## Decision

- `*.uf.tsx` files are components.
- `*.uf.ts` files are composables, compiled per target (M5).
- Plain `*.ts` modules are copied into each output tree unchanged.
- The `.uf` infix is what the bundler plugin and the content mapper key on.
- The plugin resolves each `.uf.tsx` import to a virtual id with the target's native extension,
  such as `…/Button.uf.tsx.vue` or `….svelte`. For JSX targets the `.tsx` id is kept (§8.2).

## Consequences

**Positive:**

- The file still ends in `.tsx`, so tsgo, oxc and every TypeScript editor treat it as TSX with no
  configuration.
- The infix tells Unframework components apart from a host app's own `.tsx` without include globs.
- The convention extends naturally: visual examples are `*.example.uf.tsx` (§8.6).

**Negative:**

- Framework JSX plugins also match `.tsx`, so the Unframework plugin has to run first, with
  `enforce: "pre"`. M0 spike 4 tests that ordering (R12).
- Inside a host app, `.uf.tsx` files need `jsxImportSource: "unframework"` while the app's own
  `.tsx` keeps its framework's. That takes a scoped tsconfig or the per-file pragma, and M6 settles
  which (§8.2).

**Open:**

- Whether a TS 7.1 content mapper may claim `.uf.tsx`, a suffix of a native extension, is not yet
  known. M0 spike 6 settles it against the 7.1 nightly (R3).
- If it cannot, the fallback is a distinct `.uf` extension associated with the TSX grammar, and a
  new record supersedes this one. Consumer-typing layers 1, 2 and 4 work either way (ADR-0003).

See also ADR-0023: spike 6 showed a TS 7.1 content mapper can claim `.uf.tsx`, so D1 stands.

## Alternatives considered

- **Plain `.tsx` with include globs.** Nothing in the file name would tell an Unframework component
  from a host app's own `.tsx`. The plugin and the content mapper would depend on configured globs
  rather than on the file name (§4.1).
- **`.uf`, associated with the TSX grammar.** A distinct extension is one a content mapper can
  claim without ambiguity. But editors and tools would no longer recognise the file as TSX on their
  own, and each would need the association set up. It stays the fallback if spike 6 fails (§5.6).
