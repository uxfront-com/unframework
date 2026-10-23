# ADR-0066: Firefox and WebKit run nightly, live against the reference in the same engine

- **Status:** Proposed
- **Date:** 2026-10-23
- **Plan:** §7.2 (L10), §7.4, §7.6, §9 M4, R10; D9 (ADR-0013); ADR-0062; amends ADR-0019 (the
  font audit) and ADR-0029 (the pixel mode)

## Context

M4's exit says "Firefox and WebKit run nightly". Until now every browser project ran headless
Chromium (the screenshot ADR), and three things in the harness assume it:

- `parityBrowser` launches Chromium, with two Chromium switches: `--font-render-hinting=none` and
  `--disable-partial-raster`.
- Every committed artefact is Chromium's: the DOM, ARIA and trace expectations, and the Linux
  screenshots and geometry (`*-chromium-linux.png`) that CI compares with (ADR-0013, ADR-0029).
- L10's font audit asks CDP which font drew each glyph (`CSS.getPlatformFontsForNode`). Firefox
  and WebKit have no CDP.

Per-engine baselines, gating pull requests on other engines and fixing the differences they find
are not M4's work.

## Decision

- **`UF_BROWSER=chromium|firefox|webkit`** picks the engine of the integration harness's browser
  projects. Chromium is the default, and nothing changes for it. `resolveHarnessMode` reads the
  variable and refuses any other value. The testing package's own fixture launches Chromium alone,
  because its stubs test the font audit and Chromium's switches, so it refuses another engine. `parityBrowser` takes the engine and launches it in the same context: 800×600 at
  DPR 1, the light scheme, reduced motion, the same locale and time zone. Only Chromium gets
  Chromium's switches. `ensure-browser.ts` installs the engine the variable names.
- **Outside Chromium, L10 runs live.** Each target is compared with the reference's capture from
  the same run, in the same engine, as on a developer's machine (ADR-0013's live mode). This holds
  in CI too, where Chromium compares with the committed baselines. `UF_PIXELS=baseline` is refused
  there, and so is `UF_UPDATE`: every committed artefact is Chromium's, so another engine writes
  none. This amends ADR-0029, whose pixel mode is `baseline` in CI and in the baseline
  environment, and whose `UF_PIXELS` overrides it: outside Chromium the mode is always `live`.
  L7 and L9 still compare with the committed expectations, so an engine that serialises the DOM
  differently fails there, visibly.
- **The font audit is skipped outside Chromium, with a declared reason** (`FONT_AUDIT_SKIP`): it
  reads CDP, and `document.fonts` only says that a font loaded, not that the text used it. The
  engine's parity matrix says so in its Markdown. Geometry and pixels still compare every target
  with the reference in the same engine, so a target whose text falls back alone still fails. This
  amends ADR-0019, whose command audits the fonts through CDP before every capture: it does so in
  Chromium alone.
- **Each engine's matrices are its own.** A run in Firefox or WebKit writes its partial matrices to
  `.reports/<engine>/`, so it never supersedes or merges Chromium's records of the same projects.
  The summary merges them into `parity-matrix.<engine>.json` and `.md` there. A partial matrix is
  never named after an engine, so `isPartialMatrixFile` never reads a merged one back.
- **`.github/workflows/nightly.yml`** runs on `schedule` (daily) and `workflow_dispatch`, in the
  Playwright image that ships every engine.
  - One job per engine runs all seven browser projects in one run, because live L10 needs the
    reference's capture from the same run. The job runs `scripts/run.ts`, whose summary appends the engine's
    matrix to the job summary whatever the result, and uploads it as `parity-<engine>`.
  - A difference fails its engine's job. It becomes an issue, never a quarantine entry, because the
    quarantine judges Chromium's cells, which gate pull requests.
  - `ci.yml` and its tests are unchanged. No pull request waits for the nightly.

## Consequences

**Positive:**

- The whole browser corpus runs in three engines. A difference only Firefox or WebKit shows is
  found within a day, with its cell in a matrix.
- Chromium's runs, artefacts and CI checks are untouched.

**Negative:**

- The nightly is red until each engine's differences are fixed or declared. A red night says
  something differs, not that something regressed: read the matrix.
- Live L10 only proves that the targets agree within an engine, not that they render what
  Chromium's baselines show.
- Outside Chromium a fallback font that every target shares goes unnoticed.

**Open:**

- Per-engine Linux baselines, if the nightly results show they are worth keeping.
- Whether an engine's differences become capability cells, normaliser rules or fixes in the
  targets, case by case.

## Alternatives considered

- **Compare other engines with Chromium's baselines.** Every capture would differ in its
  anti-aliasing and form controls, so the matrix would hide real differences among thousands of
  expected ones (R10).
- **One job per engine and target, as `ci.yml` runs Chromium.** Live L10 compares with the
  reference's capture in the same process, so each job would have to run the reference too: seven
  reference runs per engine for no gain.
- **Replace the font audit with `document.fonts`.** It reports which fonts loaded, not which font
  drew a glyph, so it would pass the fallback the audit exists to catch.
- **Gate pull requests on the other engines.** Out of scope for M4. It would also block every pull
  request on differences nobody has triaged yet.

## Evidence

- `packages/testing/test/mode.test.ts`: `UF_BROWSER`'s values, live pixels outside Chromium in CI
  and in the baseline environment, and the refused writes.
- `packages/testing/test/commands.test.ts`: each engine's instance, its launch switches and its
  context.
- `packages/testing/test/visual-command.test.ts`: a capture outside Chromium never opens a CDP
  session.
- `packages/testing/test/reporter.test.ts`, `packages/testing/test/summary.test.ts` and
  `tests/integration/harness/summary.unit.test.ts`: the engine's file names and directory, and a
  merged matrix that is never read back.
- `actionlint .github/workflows/nightly.yml` exits 0.
- Two full runs of each engine, on macOS with Playwright 1.63's engines (Firefox 1543, WebKit
  2359), all complete and write their matrix. Their counts differ from run to run:
  - Firefox: 35 and 38 of 3,213 tests failed, 47 and 53 cells, in 9 and 7 cases, in about 170 s.
    The differences: focus events, keyboard navigation, the colour-scheme emulation, which
    doesn't reach the tester's frame, a `-webkit-box-orient` style that Firefox serialises as
    `-moz-box-orient`, and outlines and layers in L10.
  - WebKit: 1,068 and 975 tests failed, 1,080 and 960 cells, in 186 to 272 s. 933 cells in each
    run are one difference: a click doesn't focus a button in WebKit, so the expected
    `uf:focused` is missing. The first run also timed out on 41 ARIA snapshots and 12
    screenshots.
