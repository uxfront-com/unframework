# ADR-0081: The nightly engines run one project and one file at a time

- **Status:** Accepted
- **Date:** 2026-11-10
- **Plan:** §7.3, §7.5, §7.6, §9 M4, P8, R10; amends ADR-0066 (the nightly's ordering,
  parallelism and timeout), ADR-0031 (noise is per target), ADR-0018 (rule 10, `groupOrder`) and
  ADR-0061 (the startup check of the colour scheme)

## Context

The nightly (ADR-0066) has been red every night since it landed, in both engines, for reasons
that are the harness's, not the targets':

- **WebKit is killed, out of memory.** With live pixels, `groupOrder` runs the reference alone,
  then the target a case names as its reference, then the other five followers together: five
  WebKit instances and five Vite servers in one process. In that group a spec file took about
  45 s instead of 2 s, and the runner killed the job (exit 137) 13 to 16 minutes in, with a fifth
  of the files done and no matrix uploaded.
- **Firefox's results change from night to night.** The failed files went from 87 to 99 of 1463
  between two nights, and the failed cells of two nights differed by 86 rows.
  `events/focus-and-change` logged whole blur and focus cycles while the test was idle, the same
  blur closed `events/keyboard-navigation`'s list, and focus rings flipped in L10. Vitest runs
  several spec files of a project at once, each in its own tester page of one browser, and in
  Firefox those pages take the focus from each other. A flaky parity cell is a harness bug
  (`AGENTS.md`), so the nightly said nothing a reader could trust.
- **Firefox serialises `-webkit-box-orient` as `-moz-box-orient`.** Firefox parses the prefixed
  property as an alias of its own, and `style.cssText` writes the property's name. L8 shows the
  line clamp works, but L7 failed `bindings/vendor-prefixes` on all seven targets against the
  expectation Chromium wrote. ADR-0031 lets a normaliser rule remove only a target's own noise,
  and this is an engine's.
- **Firefox applies an emulated colour scheme late.** `page.emulateMedia` returns before the
  scheme reaches the tester frame on some pages, so `theming/dark-theme`'s startup check failed
  on two to four targets a night ("does not satisfy prefers-color-scheme: dark"). The check
  throws in `beforeAll`, so those targets record no browser layer for the case at all.

ADR-0066's rules stand: one job per engine runs all seven browser projects, because live L10 needs
the reference's capture from the same run, and a difference fails its engine's job, never becoming
a quarantine entry.

## Decision

- **Outside Chromium, each browser project runs alone.** With live pixels in Firefox or WebKit,
  `groupOrder` gives every browser project a group of its own: the reference at 1, then each
  target some case names as its reference (`caseReferences`, ADR-0057), then each other target in
  the order of the run's targets, which it now takes. The node projects keep group 0, and Chromium
  keeps every group it had, in every mode. This amends ADR-0018's rule 10, which reserved
  `groupOrder` for ordering the reference first, and ADR-0066, whose job ran five followers at
  once.
- **Outside Chromium, each browser project runs one spec file at a time** (`fileParallelism:
false`, from `fileParallelism(mode)` in `harness/projects.ts`). One tester page at a time holds
  the focus, so no page sees another's blur. Chromium keeps file parallelism. Vitest 5 moves a
  project at group 0 that runs one file at a time after every other group, and refuses one there
  beside projects with another worker count, so outside Chromium the reference starts at 1.
- **The nightly's timeout is 120 minutes,** up from 45. Running one project and one file at a time
  is slower, and no pull request waits for the nightly.
- **An engine's own spelling of a property is noise for that engine alone** (rule 3b,
  `renameEngineAliases`). `normalizeHtml` and `normalizeDom` take an `engine`, which the browser
  API passes from `UF_BROWSER`. In Firefox, a `-moz-box-orient` declaration takes the name
  Chromium serialises, `-webkit-box-orient`, before rule 4a sorts the declarations. The rule names
  the engine and the property: no value changes, no other `-moz-*` property is renamed, and without
  an engine, or in Chromium or WebKit, nothing is. This amends ADR-0031, whose noise is per target:
  it is now per target, or per engine where the engine alone writes it.
- **The startup check waits for the case's colour scheme, for at most 5 s** (`checkEnvironment`
  in `browser/determinism.ts`). It reads `prefers-color-scheme` again every 50 ms until the case's
  scheme matches, then asserts every entry as before. Past 5 s it fails with the same message. The
  other entries come from the context's options, which apply before the page loads, so they are
  read once. This amends ADR-0061, whose startup check asserts the scheme as soon as the emulation
  returns. The wait holds in every engine.

## Consequences

**Positive:**

- Both engines run to completion and write their matrices, so a night's red names differences,
  not memory or a page that lost the focus.
- Two runs of the nightly fail the same cells, so a change in the matrix means a change in the
  code or the engine.
- `theming/dark-theme` records its layers on every target, so a dark-theme difference shows as a
  failed cell, not as a missing one.
- Chromium's projects, its CI and its artefacts are untouched.

**Negative:**

- Each engine's job runs far longer than before. The timeout comes from runs on another machine,
  so the owner's `workflow_dispatch` on GitHub's runner is the real check.
- A colour scheme that never applies now fails 5 s later than before.
- Genuine engine differences still fail their job, as ADR-0066 says, until each is fixed or
  declared.

**Open:**

- How to declare an engine difference that no harness fix removes, such as WebKit not focusing a
  clicked button.

## Alternatives considered

- **One job per engine and target,** a matrix of jobs each running one target. Each job would run
  the reference too, since live L10 compares with its capture from the same run (ADR-0066), so
  the reference would run seven times. It also leaves the spec files of one project competing for
  the focus.
- **Raise the timeout alone.** WebKit is killed for memory, not time, and Firefox's flaky cells
  stay flaky.
- **Report differences without failing the job.** It reverses ADR-0066's rule that a difference
  fails its engine's job.
- **Rename every `-moz-*` property.** Most have no `-webkit-*` twin, and renaming one that differs
  would hide a real difference.
- **Emulate the colour scheme in the context's options.** One browser context serves every spec
  file of a project, and each case picks its own scheme (ADR-0061), so the options can't hold it.

## Evidence

- `packages/testing/test/mode.test.ts`: each follower's own group in Firefox and WebKit, in the
  order of the targets, and `browser: "chromium"` gives the same groups as no engine in every
  mode.
- `tests/integration/harness/projects.unit.test.ts`: file parallelism is off in Firefox and WebKit
  and on in Chromium.
- `packages/testing/test/normalize.rules.test.ts`: rule 3b's mapping, a value that differs, other
  `-moz-*` properties, and Chromium's output untouched.
- `packages/testing/test/determinism.test.ts`: a scheme that applies late passes, and one that
  never applies fails after 5 s with the message from before. With the wait taken out, both
  cases fail.
