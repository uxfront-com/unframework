# ADR-0028: How the L3 and L4 checkers changed between the spikes and M0

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §7.2 (L3, L4), §7.7, P2; amends ADR-0022 and ADR-0025

## Context

ADR-0022 (TypeScript 6 checkers beside TypeScript 7) and ADR-0025 (framework compile in process)
recorded how the spikes ran each target's type checker (L4) and framework compiler (L3). Building
the toolchains, and then an adversarial review of them, changed several of those details. Each
change closes a way a layer could pass without checking what it claims to check.

## Decision

- **Every checker reports everything.** `toolchain.typecheck` and `toolchain.frameworkCompile`
  return an entry for every requested file, clean or not, plus an entry for any other file a
  diagnostic is in (an imported module, the toolchain's tsconfig). Diagnostics that belong to no
  file are keyed by the tsconfig the checker ran with. The harness fails L3 or L4 for every case
  when any entry outside the requested files has messages, and fails a requested file that has no
  entry. Before, a broken tsconfig or an error in an unlisted file was dropped and every case passed.
- **The shared plumbing lives once** in `@unframework/codegen/toolchain-node`: resolving a tool
  from the toolchain directory (never through `NODE_PATH`), running a checker with a temporary
  tsconfig that extends the toolchain's, and the tsgo run itself.
- **Svelte, L4:** `svelte-check --diagnostic-sources js --fail-on-warnings`. L4 owns types; the
  Svelte compiler's own warnings (accessibility, unused CSS) are L3's, so they are no longer
  reported twice.
- **Svelte, L3:** the compiler runs as the file declares itself, and a file that compiles in legacy
  mode is an L3 error (`legacy_mode`, from `metadata.runes`), instead of forcing `runes: true`.
  Forcing runes would hide an emitter that forgot `<svelte:options runes={true} />`.
- **Vue, L3:** each file is compiled with a private instance of `@vue/compiler-sfc`. Its `warnOnce`
  reports a script warning once per process, so with a shared instance a later file with the same
  warning passed. Positions are mapped from template offsets.
- **Qwik, L3:** every file is also parsed strictly as TSX. The Rust optimizer repairs a nested
  mismatched closing tag (`<div><h2>…</span></div>`) without a diagnostic, so output that is not
  valid TSX could pass as "accepted by its framework's compiler".
- **One type strictness for every L4 checker:** `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` and `isolatedModules`: the union of the
  frameworks' own strict project defaults. A harness test (`toolchain-strictness.unit.test.ts`)
  fails if any toolchain's tsconfig drifts. Angular's in-memory compile options (L3 and the
  `ngtscVirtual` step) add the same two flags beyond `ng new`'s defaults. vue-tsc, svelte2tsx and
  `astro check` type-check code they generate, so once outputs compose (M3) a flag may raise an
  error in tool-made code; that fails loudly and needs a per-target exception with a reason.
- **Astro, L4:** `AstroCheck` lints only the files it is given, so an error inside a module that an
  output imports is not reported. M0 outputs import only Astro; this is recorded for M3, when
  outputs import each other.

## Consequences

**Positive:**

- A checker that cannot start, a broken tsconfig, an error outside the outputs, a once-only warning
  and a silently repaired syntax error all fail now.
- The seven toolchains share one implementation of the parts that were copied byte for byte.

**Negative:**

- L3 for Qwik is stricter than Qwik's own build, which would accept the repaired file.
- A private compiler-sfc instance per file costs about a millisecond per file.

## Evidence

- Toolchain tests break a toolchain's tsconfig and put an error in an unlisted file: every
  toolchain reports it, and the harness fails the cases.
- The L3-mismatched-closing-tag canary is caught on Qwik for both basics cases, including the
  nested tag in `basics/nested-and-void`, which passed before.
- A Vue test raises the same script warning in two files in one process: both are reported.
