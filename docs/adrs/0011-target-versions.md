# ADR-0011: Target framework versions

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D7; §3 (G3), §5.5, §5.7, §9 (M8), R6, R7, R8, Appendix C

## Context

Each target emits code for one framework line and pins its tested range in `framework.range`, such
as `"react", ">=19.2 <20"` (§5.7). Several frameworks are mid-transition in October 2026
(Appendix C):

- Vue 3.6 is a release candidate, with Vapor.
- Solid 2.0 is a release candidate, with different APIs (R7).
- Qwik 2 is in beta, at 47 betas with no release date, and its QRL capture rules are strict (R6).
- The Vue, Svelte, Astro and Angular checkers still need TypeScript 6 (R8).

Targets are versioned, so a framework's new major is a target variant, not a rewrite (G3, §5.7).

## Decision

| Framework | Target              | `latest` on 2026-10-01 | Notes                                                    |
| --------- | ------------------- | ---------------------- | -------------------------------------------------------- |
| React     | 19                  | 19.3.0                 | React Compiler 1.0                                       |
| Vue       | 3.5, 3.6-compatible | 3.5.43                 | Vapor (3.6) as a target option in M8                     |
| Svelte    | 5                   | 5.57.1                 | output never uses the experimental async mode            |
| Solid     | 1.9, then 2         | 1.9.15                 | `solid@2` as an additive variant once 2.0 is stable (M8) |
| Angular   | 22                  | 22.2.1                 | zoneless and OnPush by default                           |
| Qwik      | 2, experimental     | 2.0.0-beta.47          | pinned exactly; reviewed in M8                           |
| Astro     | 7, static           | 7.3.5                  | no client runtime                                        |

## Consequences

**Positive:**

- Each target emits its framework's current idioms, such as Svelte 5 runes, Angular signals and
  `@qwik.dev/core` (Appendix A).
- Solid 2 lands as a separate package, and running it through the whole corpus is the "eighth
  framework drill" (M8). Users can ship both Solid lines from one source while they move.

**Negative:**

- Qwik 2 is a moving beta. The target is marked experimental and pinned exactly, and the corpus
  runs the real optimizer to catch breakage (R6).
- Once `solid@2` lands, there are two Solid targets to maintain (R7).
- Astro is static. Events are inert (a UF4xxx info diagnostic), interactive tests are skipped by
  capability, and the skips show in the parity matrix.
- vue-tsc, svelte-check, `astro check` and `@angular/compiler-cli` (peer `>=6.0 <6.1`) need
  TypeScript 6, confined to `tests/toolchains/*` until each moves to TypeScript 7 (R8).

**Open:**

- The Qwik decision is reviewed in M8.

## Alternatives considered

- **Qwik 1.x** (`@builder.io/qwik` 1.20.1, the stable line). The plan targets Qwik 2 instead, marks
  it experimental and reviews the choice in M8 (R6). It gives no further reason. Versioned targets
  keep a Qwik 1 variant possible (G3).
- **Solid 2 only.** Solid 2.0 is still a release candidate with different APIs (R7). Starting on
  1.9 and adding 2 as a variant follows the versioned-target model.
