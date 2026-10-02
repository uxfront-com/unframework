# ADR-0015: No runtime, only inline helpers

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D11; §3 (G2, P7, non-goals), §4.1, §5.7, §6, §7.2 (L15), §7.7, §8.4

## Context

Output must read as a senior developer of each framework would write it, and pass that framework's
compiler, type-checker and lint rules with zero warnings (G2).

- A component runtime is a non-goal for 1.0. Outputs depend only on their framework (§3, P7).
- Some targets lack a primitive the source uses (§6):
  - `class` merging on React and Solid
  - `useId` on Angular and Astro
  - attribute fallthrough and slot presence on Angular
  - `defineExpose`, scoped slots and slot presence on Qwik

## Decision

- There is no runtime package, and no `unframework` import survives into any output (ADR-0006).
- Where a framework lacks a primitive, the helper is emitted inline, kept small, and listed in the
  target's capability matrix as `emulated(helper)` (§5.7).
- Examples from §6: an inline `class` merge helper on React and Solid, a `useId` helper on Angular
  and Astro, and a helper directive for fallthrough attributes on Angular.

## Consequences

**Positive:**

- Outputs depend only on their framework. Consumers install nothing extra, and published packages
  carry each framework's native types (§8.4).
- There is no runtime version to keep in step with seven frameworks and their majors.
- Every helper appears in the golden output, so it is reviewed in PRs like the rest of the code.

**Negative:**

- A helper is repeated in every output file that needs it, which adds output size. L15 tracks output
  size per target from M6.
- A fix to a helper reaches users only when they recompile or upgrade the compiled package. There is
  no shared runtime to patch.
- Helpers have to stay small enough to inline, which limits what a target can emulate (P7).
- Every emulated capability cell needs corpus cases on its target, through the coverage gate
  (§7.7).

## Alternatives considered

- **A tiny `@unframework/runtime-<target>`.** A component runtime is a non-goal for 1.0, because
  outputs should depend only on their framework (§3, P7). It would add a dependency beside the
  framework for every consumer, and seven more packages to version alongside their frameworks.
