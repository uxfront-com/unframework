# ADR-0013: Visual baselines live in Linux CI, plus a live mode

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D9; §2, §7.1, §7.2 (L10), §7.4, §7.6, §7.9, §9 (M0 spike 2, M4), R10

## Context

Visual parity (L10) has to show that seven targets render the same pixels, and that those pixels
are the right ones.

- v1's only visual checks were Storybook screenshots compared against React, and one of 53 stories
  had interaction steps (§2).
- The harness compares every target against one target-independent artefact, never targets against
  each other directly: if all seven equal the same file, they equal each other (§7.4).
- Fonts and the operating system make screenshots drift (R10).

## Decision

- CI's Linux Playwright image generates and holds the baselines. One baseline per capture, such as
  `__screenshots__/initial-chromium-linux.png`, is compared by all seven targets (§7.1).
- Locally, a live mode compares the targets with each other in the same run, and needs no baseline.
- The tolerance across targets is zero pixels by default. Any tolerance is set per case, with a
  reason.
- Element geometry and selected computed styles are compared before pixels, because they explain a
  difference.
- Captures are deterministic: bundled fonts, no motion or caret, a fixed viewport at DPR 1, the
  light scheme, and a wait for `document.fonts.ready` and the target's settle hook (§7.6).
- CI never writes artefacts, and a missing one is a failure. In update mode only the reference
  project writes (ADR-0014).

## Consequences

**Positive:**

- A change that shifts every target the same way is still caught. Live mode alone would pass it,
  because the targets would still agree with each other.
- Baselines are reviewed files, so a visual change is visible in a PR.
- Local runs on any OS still get cross-target parity from live mode.

**Negative:**

- Baselines are regenerated only in the Linux Playwright image, so updating them from macOS or
  Windows has to go through that image.
- A local live-mode pass does not prove the CI baseline comparison will pass.
- Zero tolerance means any rendering difference fails until it is fixed or given a per-case
  tolerance with a reason. Parity failures are never retried (§7.9).

**Open:**

- How one baseline is shared across seven Vitest projects is M0 spike 2.
- Generating baselines in Linux CI is part of M4's scope.

See also ADR-0019: spike 2 settled how the seven projects share one baseline.

## Alternatives considered

- **Live mode only, as in v1.** It has no fixed reference, so it shows only that targets agree, not
  that they are right, and it cannot catch a regression that hits all targets alike. It also does
  not fit the plan's "one expectation, seven verifications" model (§7.4). It stays as the local
  mode.
