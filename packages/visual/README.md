# @unframework.dev/visual

Visual parity for a project's examples (plan §8.6, ADR-0087). It finds every `*.example.uf.tsx`
file, renders each on every target in Chromium, and compares each target's geometry, computed
styles and pixels with the reference target's, live or against baselines committed beside each
example. Each run writes `report.json` and an image of every capture. Private until its first
release.

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
2. Checks the run directory: never the root or a directory above it, and never a non-empty one
   that no earlier run marked with `.unframework-visual`.
3. Discovers the examples and checks them. UF7011 stops the run with exit 1.
4. Writes one case per example under `.unframework/specs/` (`writeSpecs`): `visual.test.ts`, which
   calls `captureExample` from `./browser`, and a `case.json` whose `main` is the example.
5. Builds `defineTestConfig({ root, pixels, include })`, keeps its `browser:<target>` projects,
   and gives each the `ufExampleCapture` command and the run's `ufVisual` context. It keeps this
   package out of Vite's dependency pre-bundling, as the testing package is.
6. Runs them with Vitest in this process, so the command's captures reach the report, then writes
   `<out>/report.json` and prints a line per example and the report's path.

`./browser`'s `captureExample(id, caseId, component)` declares one test, which mounts the example,
settles it and captures it with the testing package's `captureVisual`, sent to `ufExampleCapture`.
The test fails with L10's message when the capture fails.

`ufExampleCapture` locates the capture at the example (`exampleLocation`) and runs the testing
package's `captureAt`, so the font audit, the policy and the comparison are L10's own, with no
image code here. Its location writes each target's capture to `<out>/<id>/<target>.png`, publishes
the reference's live capture there, and leaves a failure's `reference.png`, `actual.png`,
`diff.png` and `geometry.actual.json` in `<out>/<id>/<target>/`. A missing baseline fails
`missing-artefact`, naming `unframework visual --update`.

## The report

`report.json` is a `VisualReport`, version 1, built by `buildReport`:

- `pixels`, `update`, `reference`, `targets` and `passed`.
- `examples`, each with its `id`, its `file` relative to the root and one cell per target, in the
  run's order: `target`, `role`, `status` (`passed` or `failed`), `outcome` (L10's, or
  `not-captured`), `message`, `diffPixels` (`null` when none were compared), every `geometry`
  delta and `images`, relative to the report: `capture`, and for a failure `reference`, `actual`,
  `diff` and `geometry`.

A cell with no capture fails as `not-captured`, with its test's errors. A follower whose reference
never finished the example fails `reference-not-run` (ADR-0091), and a cell captured twice fails
too, so a cell passes only when its own comparison did.

## Tests

`pnpm --filter @unframework.dev/visual test` runs the package's tests in Node. `run.test.ts` runs a
whole visual run in Chromium on `test/fixtures/differs`, whose example draws a blue box on Vue and a
red one on React, and checks that the run fails and that the report holds the cell's diff and
deltas. The command's tests drive `ufExampleCapture` with a fake browser.
