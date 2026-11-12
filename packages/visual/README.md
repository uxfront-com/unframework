# @unframework.dev/visual

Visual parity for a project's examples (plan §8.6, ADR-0087). It finds every `*.example.uf.tsx`
file, renders each on every target in Chromium, and compares each target's geometry, computed
styles and pixels with the reference target's, live or against baselines committed beside each
example. Each run writes `report.json`, an image of every capture and `report.html`, a page that shows
them. Private until its first release.

```sh
unframework visual [--target <t>]... [--baseline | --live] [--update] [--out <dir>]
```

The umbrella's bin registers the command, and loads `./cli` only when it runs, since
`@unframework.dev/cli` sits below this package in `LAYERS` (ADR-0086). The docs page is
`apps/web/content/docs/4.tooling/6.visual.md`.

| Exit code | Meaning                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | Every example matches on every target.                                                                                                      |
| 1         | An example differs on a target, never captured on one, or declares props (UF7011).                                                          |
| 2         | A usage error, `--update` outside the baseline environment, a run directory it can't empty, no example, or a configuration that won't load. |

## Examples

An example is a `*.example.uf.tsx` file whose default export takes no props. `discoverExamples`
finds them under the root at any depth, sorted by id, the path from the root without the suffix
(`examples/Buttons`). It skips `node_modules`, `dist`, dot directories and the run directory.

`checkExamples` compiles each one with no target and reports UF7011 at the props parameter of a
default export that declares props. It leaves an example that doesn't compile to the run, which
fails it on every target with the error, and throws for one with no default export.

`exampleBaselines(example)` gives the baselines beside it:
`__screenshots__/<name>-chromium-linux.png` and `__expected__/geometry.<name>.json`, in the example's
directory.

## The run

`runVisual({ root, targets?, pixels?, update?, out?, env?, stdout? })` resolves to
`{ exitCode, report?, reportPath?, diagnostics }`. It:

1. Refuses `--update` with live pixels, and outside `BASELINE_ENVIRONMENT`, before it writes
   anything. These throw `VisualUsageError`, which the CLI reports with exit 2.
2. Checks the run directory: never the root or a directory above it, never one that holds
   `.unframework/specs/` or lies in it, and never a non-empty one that no earlier run marked with
   `.unframework-visual`.
3. Discovers the examples and checks them. UF7011 stops the run with exit 1.
4. Writes one case per example under `.unframework/specs/` (`writeSpecs`): `visual.test.ts`, which
   calls `captureExample` from `./browser`, and a `case.json` whose `main` is the example.
5. Builds `defineTestConfig({ root, pixels, include })`, keeps its `browser:<target>` projects,
   and gives each the `ufExampleCapture` command and the run's `ufVisual` context. It keeps this
   package out of Vite's dependency pre-bundling, as the testing package is.
6. Empties the run directory, once the configuration has loaded, so a run that can't start keeps
   the last report.
7. Runs them with Vitest in this process, so the command's captures reach the report. Then it
   writes `<out>/report.json`, from the captures and each test's result, and `report.html`
   beside it (`renderReport`), and prints a line per example and the report's path.

`./browser`'s `captureExample(id, caseId, component)` declares one test, which mounts the example,
settles it and captures it with the testing package's `captureVisual`, sent to `ufExampleCapture`.
The test fails with L10's message when the capture fails.

`ufExampleCapture` locates the capture at the example (`exampleLocation`) and runs the testing
package's `captureAt`, so the font audit, the policy and the comparison are L10's own, with no
image code here. Its location writes each target's capture to `<out>/<id>/<target>.png`, publishes
the reference's live capture there, and leaves what a failed comparison got to in
`<out>/<id>/<target>/`: `actual.png` and `geometry.actual.json`, then `reference.png`, and
`diff.png` when the two images are the same size. The command records which of them exist for
the report. A missing baseline fails
`missing-artefact`, naming `unframework visual --update`.

## The report

`report.json` is a `VisualReport`, version 1, built by `buildReport`:

- `pixels`, `update`, `reference`, `targets` and `passed`.
- `examples`, each with its `id`, its `file` relative to the root and one cell per target, in the
  run's order: `target`, `role`, `status` (`passed` or `failed`), `outcome` (L10's,
  `not-captured` or `test-failed`), `message`, `diffPixels` (`null` when none were compared),
  every `geometry` delta and `images`, relative to the report: `capture`, and for a failed
  comparison each of `actual`, `geometry`, `reference` and `diff` it left.

A cell with no capture fails as `not-captured`, with its test's errors, the example's compile
errors first. A cell whose capture matched fails as `test-failed` when its test failed after it,
as the setup file judged it (L8, L13). A follower whose reference never finished the example fails
`reference-not-run` (ADR-0091), and a cell captured twice fails too, so a cell passes only when
its own comparison and its test did.

## The report page

`renderReport(report)` returns `report.html`: a whole page, with its styles inline and no script,
that names each image by the path `report.json` gives it. So it opens from `file://` with no
server and makes no request but those images. It holds:

- A header with the run's status, the count of failed cells, the pixel mode, the reference and
  the targets.
- For each example, a grid with one cell for each target of the run, in the run's order: its
  capture, or `actual.png` when it left no capture, its target, its role, its status and its
  outcome. The grid holds seven cells across from 70rem and wraps below that.
- For each failed cell, a section with its message, a diff overlay and its geometry deltas. The
  overlay is a radio group, so the arrow keys switch it, over one frame that stacks the cell's
  `reference.png`, `actual.png` and `diff.png`, and it offers only the images the cell left. The
  section names the files the cell didn't leave. The delta table lists the first
  `MAX_DELTA_ROWS` (100) deltas, with the node's path, the property and both values, and names
  the total when it holds more.

Every value is escaped, and every path is encoded segment by segment, so a path in the report
stays a relative file.

## Tests

`pnpm --filter @unframework.dev/visual test` runs the package's tests, in Node but for the
`browser` project below. `run.test.ts` runs a whole visual run in Chromium on
`test/fixtures/differs`, whose example draws a blue box on Vue and a red one on React, and checks
that the run fails and that the report and its page hold the cell's diff and deltas. The
command's tests drive `ufExampleCapture` with a fake browser.

The `browser` project runs `test/**/*.browser.test.ts` in Chromium. `report-page.browser.test.ts`
renders the fixture runs under `test/fixtures/report-failed` (one failed cell on seven targets)
and `test/fixtures/report-missing` (cells that left fewer files) to `.output/<fixture>/report.html`,
which stays on disk, and checks the grid, the overlay by keyboard, the delta table, the tab order
and axe-core, through the testing package's `toHaveNoAxeViolations`.
