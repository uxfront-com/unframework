# ADR-0029: The artefact write policy and visual parity, as built

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §7.4, §7.6, §7.7, §7.9, D9, D10; amends ADR-0019

## Context

ADR-0019 (spike 2) chose a custom browser command over `toMatchScreenshot`, because only a command
lets the harness decide who may write a shared artefact. That core decision stands. Building the
harness, and an adversarial review of it, changed most of the policy details ADR-0019 recorded:

- Geometry is not platform-independent once a case has form controls: a text input is 160px wide
  on macOS and 200px on Linux, even with `--font-render-hinting=none`.
- A Linux host that is not the CI image (a developer's machine, an arm64 container) could write the
  committed `-linux` baselines, which the browser jobs then compare at zero tolerance.
- With live pixels, the reference target's own L10 was recorded as `pass` although nothing was
  compared.
- Runs deleted each other's scratch output, and stale partial matrices leaked into summaries.

## Decision

- **Modes.** `UF_UPDATE=1` (`pnpm test:update`) is update mode; Vitest's `-u` is refused, and so is
  update mode when `CI` is set. `UF_PIXELS=baseline|live` overrides the pixel mode, which is
  `baseline` only in CI or inside the baseline environment, and `live` everywhere else, a plain
  Linux host included.
- **The baseline environment.** `scripts/baselines-in-container.sh` exports
  `UF_BASELINE_ENVIRONMENT="<image> linux/<arch>"`. Committed PNGs and geometry are written only
  when it equals `BASELINE_ENVIRONMENT` from `@unframework/testing/node`
  (`mcr.microsoft.com/playwright:v1.63.0-noble linux/amd64`); otherwise the visual command refuses
  the write. A harness test checks that this constant, the script's image and every
  `image:` in `ci.yml` agree. In update mode the container's only host mount is the repository,
  read-only; it stages changed baselines in its own directory, and `baselines.sh` copies them out
  with `docker cp` after the container stops. It copies only regular files at
  `cases/<area>/<name>/__screenshots__/<scenario>-chromium-linux.png` and
  `__expected__/geometry.<scenario>.json`, refuses the whole copy if the container left anything
  else, and never writes through an existing destination.
- **Geometry follows the pixel mode.** With baseline pixels (CI, the container), geometry is compared
  with the committed `__expected__/geometry.<name>.json`, then pixels with
  `__screenshots__/<name>-chromium-linux.png`. With live pixels, every follower compares both with
  the reference's capture from the same run, and nothing visual is written.
- **The live reference records a skip.** With live pixels, `browser:vue`'s L10 is
  `skip(live pixels: the reference's capture is this run's expectation)`.
- **Ordering.** In update mode the compile project runs first (group 0), the reference projects
  (`ssr:vue`, `browser:vue`) second, and the followers last. In check mode with live pixels
  `browser:vue` runs before the other browser projects; with baseline pixels everything runs in
  parallel.
- **Scratch is per run.** `.reports/diffs/<runId>`, `.live/<runId>` and `.reports/ledger/<runId>`;
  a run removes only the directories of processes that have ended.
- **The summary replaces the visual-parity reporter.** Partial matrices record their projects, mode,
  filters, shard, quarantine and end time. The summary keeps each project's newest record per
  cell and judges merged records by the newest run's quarantine. A project counts as having run
  when a run nothing narrowed covered it, or when shards 1..n of one count and one project
  selection, none otherwise filtered, all reported (plan §7.9 shards `integration:browser`); each
  shard's matrix has its own file name (`<run>+shard-<i>-of-<n>`), so merged downloads keep them
  all. A project covered only by a file, name, tags, changed or watch filter, or by an incomplete
  shard set, is partial, with no missing-cell or staleness checks, and the summary names the
  missing shards. In a complete set, a project that collected no tests in every shard fails. Only
  CI's parity job, which merges every job's matrix, requires every project and fails on a missing
  cell; a local or browser-only run judges just the projects it selected. Given the run's start
  time, the summary fails a run that never reported instead of re-printing an older green
  summary.
- **The quarantine knows the pixel mode.** An L10 entry may name `pixels: "baseline"` or `"live"` and
  applies only in runs of that mode, so an entry for the live reference's L10 does not go stale
  locally.
- **One rule for names.** Areas, case names, SSR scenarios and `expectParity` scenarios match
  `KEBAB_CASE` (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, from `@unframework/testing/node`). `expectParity`, the
  visual command, `ufArtefact` and `harness/cases.ts` check it, and a harness test runs
  `baselines.sh` on edge names to prove its copy-back filter accepts exactly the same ones.
- **Console output outside a test still counts.** A message logged after a file's last test is
  recorded on the file and reaches its L13 cells.

## Consequences

**Positive:**

- No machine but the CI image can change what CI compares against, and macOS still gets geometry
  and pixel parity between the targets on every run.
- Every cell says what was actually compared.

**Negative:**

- Locally, an L10 regression that every target shares is invisible in live mode; only CI's
  baselines catch it.
- Committed baselines come from an amd64 image that runs under emulation on Apple silicon; the first
  CI run is what validates them on a native x64 runner.

## Evidence

- `bash tests/integration/scripts/baselines.sh check --project "*"` (CI=1, the CI image): every
  project green against the committed Linux baselines.
- `pnpm test` on macOS: green, with `browser:vue`'s L10 recorded as the live-reference skip.
- The L10-root-hidden canary fails L10 on every follower, with geometry and pixel evidence.
- `harness/summary.unit.test.ts` splits CI's real job layout into two browser shards per target:
  the CI summary is green, and red with the exact problem once one shard's matrix is deleted. Two
  real `--shard 1/2` and `2/2` runs summarise as complete.
