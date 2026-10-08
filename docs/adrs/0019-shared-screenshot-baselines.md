# ADR-0019: Screenshot baselines are shared through a custom browser command

- **Status:** Accepted (M0 spike), amended by ADR-0029 and ADR-0050
- **Date:** 2026-10-01
- **Plan:** §9 (M0 spike 2); §11 D9 and D10; §7.1, §7.2 (L10), §7.4, §7.6, §7.7, §7.9, R10

## Context

L10 needs one visual expectation per case scenario, shared by every target:
`cases/<id>/__screenshots__/<name>-chromium-linux.png`, with geometry and selected computed styles
compared before pixels. ADR-0013 and ADR-0014 add the rules: CI never writes and a missing artefact
fails; in update mode only the reference project, `browser:vue`, writes; macOS has no committed
baseline and compares targets live; the tolerance is zero pixels unless a case gives a reason; and
captures are deterministic (§7.6).

Vitest 5.0.3 ships `expect.element(locator).toMatchScreenshot(name, options)`, configured under
`browser.expect.toMatchScreenshot`. Reading `@vitest/browser` (`resolveOptions`,
`screenshotMatcher`, `determineOutcome`, `performSideEffects`) and probing it showed:

- **One file for every project works.** `resolveScreenshotPath` receives the capture's `arg`,
  `browserName`, `platform`, `testFileName`, `testName` and `project`, among others, and may ignore
  the project.
- **The write policy is global to the run.** It comes from
  `snapshotOptions.updateSnapshot`, which Vitest copies from the root config into every project, so
  a per-project `update: false` is silently ignored. Under `all` (`-u`) any project whose capture
  differs overwrites the reference and passes. Under `new` (the local default) a missing reference
  is written and the test fails. Under `none` (CI) a missing reference goes only to
  `.vitest/attachments`, and the test fails.
- **A custom comparator cannot help.** It decides pass or fail only. It is never called when the
  reference is missing, and under `-u` its failure still updates the reference.
- **The default comparator is not zero tolerance.** It is pixelmatch with `threshold: 0.1` and
  `includeAA: false`.

Only Vue was a real framework in this spike (plugin-vue 6.0.9). `browser:react` and
`browser:svelte` mounted plain HTML as stand-ins, and Solid, Angular, Qwik and Astro were not run.

## Decision

1. **A custom browser command replaces `toMatchScreenshot`.** Tests call one helper,
   `expectScreenshot(locator, name, { tolerance? })`, which calls the command `ufVisualCapture`.
   Command names must match `/^[\w$]+$/`; `uf:visualCapture` fails at startup with
   `Invalid command name`.
   - **In the browser**, the helper settles (fonts loaded, the target's settle hook,
     `document.fonts.ready`, two animation frames), snapshots geometry and computed styles, marks
     the container and calls the command.
   - **In Node**, the command audits fonts through CDP `CSS.getPlatformFontsForNode`, so a glyph
     drawn in a system font fails. It captures with Playwright
     `locator.screenshot({ animations: "disabled", caret: "hide", scale: "css" })` until two
     consecutive captures are byte-identical (at most 11). It compares geometry first, then pixels
     by exact RGBA equality; pixelmatch only draws the diff image. Then it applies the write policy.
   - **On failure** it writes reference, actual and diff images plus the actual geometry to
     `.uf-visual/diffs/`, and records a
     `{ type: "internal:toMatchScreenshot", kind: "visual-regression" }` artifact, so reporters and
     the UI show the images as they would for `toMatchScreenshot`.
   - **A tolerance** is `{ maxDiffPixels, reason }`. An empty reason throws, in the browser and in
     Node.
2. **Two switches, resolved once at config time by `resolveVisualMode`:**

   |                         | pixels = `baseline` (Linux)                                                                                    | pixels = `live` (macOS, Windows)                                                           |
   | ----------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
   | check (`pnpm test`, CI) | Every target, the reference included, compares against the committed files. A missing file fails. In parallel. | Geometry against the committed file. Pixels against `browser:vue`'s capture from this run. |
   | update (`-u`)           | `browser:vue` writes the PNG and geometry. The others compare against that capture. `pnpm test:baselines`.     | `browser:vue` writes the geometry. Pixels are live. `pnpm test:update` on a Mac.           |
   - `-u` is read from `process.argv` (`-u`, `--update`, `--update=`). `-u` with `CI` set throws,
     and so do live pixels with `CI` set. `UF_VISUAL_PIXELS` overrides the platform default.
   - At run time the command asserts that Vitest's update state matches the resolved mode. That
     catches pressing `u` in watch mode.
   - Vitest evaluates the config once for the root and once per project, so module state is not
     shared. Run state lives in `globalThis[Symbol.for("unframework.visual.state")]`, which the
     commands and the reporter share in the main process. The live scratch directories are wiped
     once per process, so a capture from an earlier run is never compared against.

3. **The reference runs first when followers need it.** In update mode, or with live pixels,
   `browser:vue` gets `sequence.groupOrder: 0` and every other browser project `1`. Vitest runs
   groups one after another, browser projects included. Projects sharing a group must resolve to the
   same `maxWorkers`, or Vitest throws. In CI (check, baseline pixels) every project is group 0.
   A follower that finds no reference capture from this run fails with `missing-reference-capture`.
4. **Geometry is a platform-independent artefact.** Each scenario commits one
   `__expected__/geometry.<name>.json`. Elements are keyed by a path relative to the container
   (`tag[i]` among same-tag siblings, `#text[i]` for non-blank text), and elements with
   `display: contents` are transparent, for ADR-0010's Angular hosts. Each element records its
   border box and 62 computed properties, and each text node its line boxes. Chromium runs with
   `launchOptions: { args: ["--font-render-hinting=none"] }`; without it, Linux snaps glyph advances
   to whole pixels and geometry differs from macOS.
5. **Determinism settings:**
   - **Font:** `@fontsource/inter` 5.3.0 (OFL), Latin 400 and 700, registered through `FontFace`
     as `"UF Test Sans"` before any mount. The reset includes
     `button, input, select, textarea { font-family: inherit }`, because Chromium's UA stylesheet
     does not inherit fonts into form controls. CDP reports the font file's internal name, so the
     audit allows `"Inter"` with `isCustomFont`.
   - **Motion and caret:** `animation-duration: 0s`, `transition: none` and
     `caret-color: transparent`, all `!important`.
   - **Context:** the provider's `contextOptions` are `deviceScaleFactor: 1`,
     `colorScheme: "light"`, `reducedMotion: "reduce"`, `forcedColors: "none"`, `locale: "en-US"`
     and `timezoneId: "UTC"`, with `headless: true` and `viewport: { width: 800, height: 600 }`.
     `headless` defaults to `!!process.env.CI`, and headed UI mode inherits the host DPR. The setup
     asserts DPR 1, reduced motion, the light scheme and no forced colours before any test.
6. **Linux baselines come from `mcr.microsoft.com/playwright:v1.63.0-noble` on linux/amd64.**
   `pnpm test:baselines` runs `scripts/baselines.sh`, which calls `docker run` with
   `--platform linux/amd64 --ipc=host --init`. Inside, it copies the sources without `node_modules`
   or `.git` to `/work` (never installing into the mounted repo), enables pnpm through corepack,
   runs `pnpm install --frozen-lockfile` against a named store volume per platform and then
   `vitest run -u`, and copies back only `**/__screenshots__/*-linux.png` and
   `**/__expected__/geometry.*.json`. `pnpm test:baselines:check` runs CI mode in the same image.
   The image tag moves in lockstep with the `playwright` devDependency.

## Consequences

**Positive:**

- The harness owns the write policy, so no target can silently become the reference.
- Macs get real local signal: committed geometry and computed styles everywhere, and pixels live
  against `browser:vue`. Darwin pixels never equal Linux pixels, so no darwin PNG is written.
- Geometry is stricter than pixels. `padding-left: 1px` on an empty block failed geometry with 0
  pixels different, which is intended: the targets must produce the same CSS.
- A reporter writes `.uf-visual/visual-parity.json` and checks how many targets each capture
  compared (§7.7).

**Negative:**

- The same run-wide update flag affects `toMatchFileSnapshot` in browser projects, so the other
  shared artefacts (`dom.*.html`, `aria.*.yaml`, traces) need the same "reference writes, followers
  compare against this run" pattern.
- Update and live runs run the reference alone first, adding about one target's share of the browser
  run. CI is unaffected.
- About 650 lines of harness code (`visual.ts` is 415) replace a built-in matcher.
- `.uf-visual/` and `.vitest/` must be gitignored. Vitest 5 writes failure screenshots under
  `.vitest/attachments/failure-screenshots/`, and the JSON reporter does not include artifacts.
- Screenshot names are keys within the case directory, derived from the spec's directory. The helper
  enforces kebab-case but does not yet detect duplicates, and the copy-back never prunes stale
  files.

**Open:**

- Validate the baselines, made under Rosetta (which exposes AVX2), on a real GitHub ubuntu-24.04 x64
  runner, including one with AVX-512, by running `pnpm test:baselines:check` in CI once.
- Repeat zero-pixel parity with real React, Svelte, Solid, Angular, Qwik and Astro mounts and their
  settle hooks. Their DOM may need more geometry normalisation than `display: contents`.
- The font audit calls `DOM.getDocument({ depth: -1, pierce: true })` per capture; scope or cache it
  before 250 cases × 7 targets.
- Windows live mode is untested. On Linux hosts the copied-back files are root-owned, so the script
  needs `--user $(id -u):$(id -g)`.

## Alternatives considered

- **`toMatchScreenshot` with a shared `resolveScreenshotPath`.** With
  `UF_CANARY=react vitest run -u` all 3 tests passed and React's perturbed rendering overwrote the
  shared baseline. The next plain run failed all three. A per-project `update: false` changed
  nothing.
- **`toMatchScreenshot` in two invocations** (`-u --project browser:vue`, then a run with
  `UPDATE_SNAPSHOT=none`). Workable for update mode, but it starts two servers and two browsers,
  live mode is awkward, and the font audit, geometry first, exact zero tolerance and the parity
  counts are still missing.
- **A custom comparator.** Comparators do not control writes.
- **Comparing everything at the end** in a reporter or a final project. It keeps full parallelism,
  but the failure lands on the run rather than on the target's own test, and it does not cover
  update mode.
- **Geometry per platform.** Not needed: with `--font-render-hinting=none` the geometry is
  byte-identical between macOS and Linux.

## Evidence

The host was macOS arm64 with Node 24.21 and Docker Desktop 29.4.3. The image had Node 24.20.0 and
`chromium-1243`.

- **Shared path probe.** All three projects resolved to one
  `__screenshots__/initial-chromium-darwin.png`. On the first run `browser:vue (chromium)` wrote it
  and failed, and the other two raced to compare against it.
- **`-u` with a non-reference canary.** The baseline's sha went from `46a8eff…` to `6870b12…` with
  "Tests 3 passed". The next plain run failed all 3: "332 pixels (ratio 0.01) differ".
- **`CI=1` with no reference.** All 3 failed with "No existing reference screenshot found", and
  nothing was written next to the case.
- **Live mode on macOS with `groupOrder`:** "Tests 9 passed", 5 of 5 repeated runs passed. Without
  it, three runs gave 4 failed, 6 passed and 3 failed, all `missing-reference-capture`.
- **Canaries on macOS:** `UF_CANARY=react` gave `geometry-mismatch`
  (`section[0]/span[0] box: [25,85,31.296875,20] → [25,85,24.296875,20]`,
  `padding-left: "8px" → "1px"`), then 332 pixels. `:pixel` gave 544 pixels. `:font` and `:pseudo`
  (`::after { content: "漢" }`) gave `font-fallback`, naming the system fonts. A
  `{ maxDiffPixels: 600, reason }` tolerance gave `matched-within-tolerance diffPixels=544`.
- **Geometry across platforms.** Without the flag Linux gave `194` where macOS gave `194.25`. With
  it, `shasum -c` of macOS geometry against Linux geometry was OK for all 3 files. Pixels still
  differed: 3,440 of 41,580, 1,787 of 44,274 and 1,702 of 68,160.
- **`pnpm test:baselines` on linux/amd64:** 13–17 s with a warm store, about 3 s of it Vitest; the
  first image pull took about 4 minutes. A second run was byte-identical, and a linux/arm64 run was
  byte-identical to amd64, including box-shadow, a gradient, `rotate` with opacity, synthesised
  italic and a scroll container.
- **Policy runs in Docker amd64:** `CI=1` passed 9. `CI=1 -u` refused to run. `CI=1` without the
  hello PNG failed 3 and wrote nothing. `-u` with a geometry canary in React failed 3, and with a
  pixel canary in Svelte "3 failed | 6 passed"; both ended "BASELINES UNCHANGED".
  `CI=1 --project browser:react` passed 3, because check mode needs no reference run.
- **Other checks:** `pnpm test:baselines:check` passed 9 in 14 s. Removing `reducedMotion` and
  setting `deviceScaleFactor: 2` failed setup. A reporter's `onTestCaseArtifactRecord` received the
  `visual-regression` artifact with its three attachments.
