# @unframework/testing

The cross-target test API (plan §7.3, §8.5): one spec, written once, runs in every
`browser:<target>` project and verifies the shared expectations layer by layer. Private until M7.

```ts
// cases/basics/hello/hello.test.ts
import { describeTargets, mount } from "@unframework/testing";
import { expect, it } from "vitest";

import Hello from "./Hello.uf.tsx";

describeTargets("basics/hello", () => {
  it("renders the greeting", async () => {
    const view = await mount(Hello);
    await view.expectParity("initial"); // L7 DOM + ARIA, L10 geometry + pixels, L11 axe
    await expect.element(view.getByText("Hello, world!")).toBeVisible();
  });
});
```

## Browser (`@unframework/testing`)

- **`mount(component, { props })`** mounts with the project's registered adapter into a
  `<div data-uf-root>` in the page's `<body>`, and returns a **`View`**: `container`, a
  `locator` (`page.getByTestId("uf-root-N")`, stable as the DOM changes), `getBy*` queries scoped
  to the container, `html()` (the normalised DOM), `settle()` and `unmount()`.
- **`view.expectParity(name, { tolerance? })`** settles, then verifies the scenario against the
  case's shared expectations: L7 (`__expected__/dom.<name>.html` and Playwright's
  `aria.<name>.yaml`), L10 (geometry and computed styles, then pixels, through
  `ufVisualCapture`) and L11 (axe-core on the container: no violations, or exactly
  `case.json`'s `axe` list). Each layer is recorded in `task.meta.uf`; the test then fails with
  every message. No landmark wraps the mount root, so a component may render its own `<main>`;
  axe's `region` rule (all content inside landmarks) is off, because placing a component in the
  page's landmarks is the page's job.
- **L10 follows the environment.** In CI and in the baseline environment (the Playwright image
  `pnpm test:baselines` runs, `BASELINE_ENVIRONMENT`) it compares with the committed
  `__expected__/geometry.<name>.json` and `__screenshots__/<name>-chromium-linux.png`, and only
  that environment writes them. Elsewhere, any Linux host included, it compares each target with
  the reference's capture from the same run, and records the reference's own L10 as a skip:
  nothing was compared. Pixels differ between hosts, and so does geometry once a case has form
  controls (a text input is 160px wide on macOS and 200px on Linux). The font audit walks the
  user-agent shadow roots and generated content, so a `<textarea>`'s text is checked too.
- **`describeTargets`**, **`currentTarget`**, **`allowConsole(pattern, reason)`** (for the
  current test, every matching message, whatever the pattern's flags), and
  **`registerTarget(target, mount)`** for the per-target setup files.

## Setup files

- **`@unframework/testing/setup`**, loaded first by every browser project: the bundled Inter font
  as "UF Test Sans", the motion and caret reset, the startup assertions (DPR 1, reduced motion,
  light scheme), console capture recorded as **L13** for every test of a case (plus the
  adapter's server-side console), and cleanup. The capture starts when the file loads and
  discards nothing: a message logged while the modules evaluate or in a `beforeAll` hook fails
  the next test, marked as logged before it; the console is judged after the unmount's
  scheduled work has run; and a message after a file's last test fails the file.
- **`@unframework/testing/<target>`** (`react`, `vue`, `svelte`, `solid`, `angular`, `qwik`,
  `astro`): registers `@unframework/target-<target>/toolchain/client`'s mount adapter.

## Node (`@unframework/testing/node`)

- **The write policy** (DESIGN §4.4), as plain functions every driver shares:
  `settleArtefact(path, actual, context)` and `settleArtefactDirectory(dir, files, context)`.
  Check mode compares and never writes; in update mode owners and the reference target write,
  and followers compare against what the reference wrote in the same run (a per-run ledger).
- **The run:** `resolveHarnessMode` (`UF_UPDATE`, `UF_PIXELS`, `UF_CANARY`,
  `UF_BASELINE_ENVIRONMENT`; it refuses writing in CI, and writing the visual baselines outside
  `BASELINE_ENVIRONMENT`), `createHarnessRun` (the context provided to every project as
  `ufHarness`; each run's scratch output is its own directory, so concurrent runs never clear
  each other's; an L10 quarantine entry that names `pixels` applies only in runs of that pixel
  mode) and `groupOrder`.
- **Browser commands:** `browserCommands` (`ufArtefact`, `ufAriaSnapshot`, `ufVisualCapture`),
  and `parityBrowser({ name, commands })`, the deterministic Chromium every parity project runs
  (800×600 at DPR 1, `--font-render-hinting=none`, light scheme, reduced motion). A target's
  command may not take one of the testing API's names.
- **Layers:** `checkLayers(task, subject, { L1: () => …, L2: … })` runs checks, records each
  outcome and throws one error with every failure. A check skips only by returning
  `{ skip: reason }` with a reason. A failure the quarantine covers is recorded as quarantined;
  a pass under an entry is recorded as a pass, because a quarantine entry is judged per
  (case, target, layer) cell, over every test that records it.
- **The parity matrix:** `ParityReporter` writes `parity-matrix.<run>.json`, with each
  project's cells (and what a test file recorded after its last test), the run's mode and when
  it ended. It fails the run when a selected project collected no tests, when a test was
  skipped without recording why, and, once a run has every record of a cell, on a stale
  quarantine entry. A run of some projects replaces exactly those projects' records in earlier
  matrices; a filtered run (files, test names, tags, `--changed`, `related`, watch mode) or a
  shard replaces nothing. A shard covers its projects in full only together with shards 1 to n
  of the same selection and count, with no other filter; the summary then also fails a project
  no shard collected a test of. `writeSummary` merges the partial
  matrices into `parity-matrix.json` and `parity-matrix.md` (each project's cells from its last
  run, the runs listed, every record judged by the newest run's quarantine) and appends the
  Markdown to `$GITHUB_STEP_SUMMARY`; in CI (or with `requireComplete`) a project that did not
  run, or that only filtered runs or an incomplete set of shards ran, is a problem, not a partial
  run, and `since` restricts
  it to the runs that ended since a time.

## Normalisation (`@unframework/testing/normalize`)

`normalizeHtml(html, { target })` turns any target's HTML into one canonical text (plan §7.5).
Only the named target's framework noise is removed (Angular's hosts only from Angular's
output); without a target nothing is noise. Generated ids are the compiler's `uf-id-…` ids, by
provenance, in the references `@unframework/ir` lists (the analyzer reserves the prefix in the
same ones): authored ids are never renamed. Whitespace collapses as Chromium lays it out, rubies
and bidi isolates included; a whitespace text that collapses away beside a ruby stays, printed
as `""`, because Chromium's ruby layout still sees it. `serializeDom` and `normalizeDom` read a
live subtree, form-control state included; `normalizeDom` throws on a live element, attribute
or text that the HTML parser would rebuild differently (an SVG child created in the HTML
namespace, `viewbox`, a table row without its `<tbody>`, a carriage return).

## Tests

`pnpm test` runs the unit tests in Node, the DOM tests in Chromium, and then the parity suite
(`test/parity/`): the browser API end to end against a framework-free stub target, with its
own committed artefacts. `UF_UPDATE=1 pnpm exec vitest run --config test/parity/vitest.config.ts`
rewrites them.
