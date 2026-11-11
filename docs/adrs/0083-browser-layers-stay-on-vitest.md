# ADR-0083: The browser layers stay on Vitest

- **Status:** Accepted
- **Date:** 2026-11-11
- **Plan:** §7.2 (L7–L11, L13), §7.3; ADR-0013, ADR-0018, ADR-0019, ADR-0062

## Context

ADR-0018 runs L7 to L11 and L13 in one Vitest run, with one `browser:<target>` project per target.
A proposal set out to replace those projects with seven static Storybooks, one per target, driven by
Playwright. It had three aims: build each framework once and run each interaction once, give each
target a catalogue to browse, and give each framework its own process, to ease local memory. It was
to port Vue first, on a sample of 22 cases, and stop if Vue came out worse.

The first stages were built on a branch: a port that hid the runner behind a host, a page host with
no Vitest in it, a Playwright driver and reporter, and a generated Storybook for Vue. Vue's sample
then ran on both runners on the same commit, a Mac Studio, three pages each, medians of three cold
runs:

| Measure                                 | Playwright and Storybook | Vitest today |
| --------------------------------------- | ------------------------ | ------------ |
| Cells that differ, sample (132)         | 0                        |              |
| Sample wall time                        | 18.6s                    | 16.2s        |
| Sample peak memory                      | 2.81 GiB                 | 2.21 GiB     |
| Storybook build of the whole corpus     | 3.3s, 1.31 GiB           | no build     |
| Projected `browser:vue`, build included | 160.8s                   | 140.2s       |
| Linux L10 on the sample, in CI          | pass, 21 of 22           | pass         |

The 22nd case, `semantics/listbox`, has no Vue output. The projection is the build plus the sample's
time scaled by 508 tests to 60, against `browser:vue`'s measured 140.2s at the start of the work.

Vue's whole corpus was then measured directly, one run each on the same commit:

| Runner                               | Wall time | Peak memory | Result                 |
| ------------------------------------ | --------- | ----------- | ---------------------- |
| Playwright, with its Storybook build | 133.6s    | 2.83 GiB    | 209 spec files passed  |
| Vitest, `browser:vue`                | 110.7s    | 3.00 GiB    | 506 passed, 2 skipped  |
| `matrix-diff.ts` of the two matrices |           |             | 0 of 1254 cells differ |

So the port gave the same verdicts, and the driver wasn't the cost: each spec file took as long as
on Vitest, and a page was ready in about 0.2s. The cost was fixed, since each Playwright worker is a
Node process of about 330 MiB with a browser of its own, where Vitest runs one process.

Memory wasn't the problem either. The full Vitest browser run, all seven projects at three pages
each, peaked at 15.5 GiB and took 556.6s, well inside a 32 GB machine.

The proposal also asked for proof that the seven targets render the same pixels. L10 already gives
it. It matches geometry and selected computed styles first, then pixels at zero tolerance against
one shared Linux baseline (ADR-0013, ADR-0019). On CI's Linux run of #148, L10's cases per target
were:

| Target            | L10 pass | L10 skip |
| ----------------- | -------- | -------- |
| Svelte            | 209      | 112      |
| React, Solid, Vue | 208      | 113      |
| Angular           | 205      | 116      |
| Qwik              | 203      | 118      |
| Astro             | 199      | 122      |

Each skip carries its reason in the parity matrix.

## Decision

- **L7 to L11 and L13 stay in the Vitest `browser:<target>` projects.** ADR-0018 stands as written.
- **The Storybook port stops.** The host port, the page host, the Playwright driver,
  `@unframework/visual` and the `tests/storybook` packages don't land on `main`. They stay on
  their unmerged branch for reference.
- **The two measuring tools land.** `tests/integration/scripts/measure.ts` records a command's wall
  time, peak memory and leftover processes, and `matrix-diff.ts` compares two parity matrices cell
  by cell. Neither depends on the runner, so they serve any later change to how the browser layers
  run.

## Consequences

**Positive:**

- The browser layers keep the faster runner for Vue alone, and no check changes.
- No Storybook, Playwright test runner or second runtime for specs enters the catalog.
- A later proposal starts from the two tools and the figures above, not from reading the code.

**Negative:**

- Nothing in this repository shows the project shape of one Storybook per framework that the
  proposal wanted users to adopt.
- The full seven-target run on Playwright was never measured, so the comparison rests on Vue alone,
  where Playwright's fixed cost weighs most.

## Reopening it

This decision holds until a proposal brings new evidence of one of these kinds:

- A full run of every browser layer on all seven targets, Storybook builds included, that beats the
  Vitest run on the same commit and machine, measured with `measure.ts`, and whose matrix
  `matrix-diff.ts` finds identical.
- A check that the corpus needs and Vitest's browser mode can't run.
- A defect or end of support in Vitest's browser mode that blocks a layer.

A Storybook catalogue of the corpus, or a handful of cross-framework screenshots as a showcase, is a
separate question. Neither needs the checks to move, so neither reopens this one.

## Alternatives considered

- **Carry on, with a stop point after the first stage that runs all seven targets.** It would have
  measured the full run, at the cost of porting React, Solid and Svelte first. L10 already proves
  the pixel parity the proposal wanted, so the remaining gain was speed, which Vue's figures didn't
  point to.
- **Move only the visual checks to Storybook.** In Vue's corpus, 542 of 630 visual scenarios are
  taken after the spec has clicked, typed or changed props. Static stories can't reach those states
  without a second copy of each spec's steps, or a second run of the spec, and checking only the
  static states would weaken L10.
- **Keep the host port as an abstraction.** With one host left, it's an indirection that nothing
  needs.
