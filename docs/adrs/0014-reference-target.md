# ADR-0014: Vue is the reference target for expectations

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D10; §4.5, §6, §7.1, §7.4, §7.5, §9, Appendix A

## Context

Cross-target parity comes from shared, target-independent artefacts: `__expected__/ssr.*.html`,
`dom.*.html`, `aria.*.yaml`, `trace.*.json` and `__screenshots__/*.png` (§7.1). Every target is
compared against the same files, never against another target directly (§7.4).

- Vitest projects run in isolation, so one project has to produce the files that the others are
  compared against.
- The corpus grows to about 233 cases by M10, each with several artefacts (§9).
- Screenshots and accessibility trees are impractical to write by hand.
- The source's semantics are Vue's wherever every target can meet them (§4.5).

## Decision

- Vue is the reference project.
- In update mode (`pnpm test:update`), only the reference project writes artefacts, and every other
  target must then match them.
- CI never writes artefacts, and a missing artefact is a failure.
- Generated artefacts are reviewed. For each feature, the case's expected artefacts come from the
  Vue reference, and someone reviews them before the target lanes start (§9).

## Consequences

**Positive:**

- Vue's output is the closest to the source. In Appendix A it keeps the macros and the setup almost
  verbatim, so it is the least likely to introduce a difference of its own.
- Vue renders every row of the mapping table natively, with no emulated cell (§6), so it can
  produce an expectation for any case.
- A new case costs one update run and a review, not hand-written HTML, YAML and screenshots.

**Negative:**

- A Vue bug, or a bug in the Vue target, becomes the expectation until review catches it. The
  other six targets would then fail against it, which points at the expectation as much as at them.
- Every generated artefact needs a careful human review, for every case.
- Vue's own framework noise, such as `<!--v-if-->` anchors, has to be normalised away like every
  other target's (§7.5).

See also ADR-0019: the reference project runs first when the others compare against this run.
See also ADR-0033: a construct Vue renders differently on its client is declared unsupported in
Vue's capability matrix, so no corpus case can contain it while Vue is the reference.

## Alternatives considered

- **Hand-written expectations only.** At corpus scale that is slow, and pixel baselines and
  accessibility trees are not practical to author by hand. The plan keeps a human in the loop by
  reviewing generated artefacts instead.
