# ADR-0087: Examples run on every target through `@unframework.dev/visual`

- **Status:** Accepted
- **Date:** 2026-11-12
- **Plan:** §7.2 (L10), §7.6, §8.3, §8.6, §9 M7; ADR-0013, ADR-0019, ADR-0029, ADR-0057,
  ADR-0083, ADR-0086, ADR-0091

## Context

Plan §8.6 asks for visual parity on a project's own examples: `*.example.uf.tsx` files, rendered
on every target and compared geometry first, then pixels, against one shared baseline or live.
L10 already does this for the corpus, but every piece of it was bound to a case's scenario:

- the baseline paths were the case's `__screenshots__/` and `__expected__/geometry.<name>.json`;
- the reference's live capture and a failure's images went to the run's scratch, by case id;
- a passing capture left no image, so nothing could show what each target drew.

Nothing found examples, and `unframework build` compiled every `**/*.uf.{tsx,ts}` under `srcDir`,
so an example kept beside its component would have been packaged.

ADR-0083 keeps the browser layers on Vitest, and ADR-0086 gave a project the corpus's browser
projects through `defineTestConfig`. A second runner would split L10 in two.

## Decision

- **`@unframework.dev/visual` is a package one layer above the testing package** (`LAYERS`),
  private until a release, like `@unframework.dev/testing` (ADR-0085). It depends on the testing package
  and the compiler, and has no image code of its own: the comparison is L10's.
- **An example is a `*.example.uf.tsx` file whose default export takes no props.** Its id is
  its path from the project's root without the suffix (`examples/Buttons`). Discovery finds them
  at any depth, and skips `node_modules`, `dist`, dot directories and the run directory. An
  example whose component declares props is UF7011 (`example-with-props`, an error) at its props
  parameter, and the run doesn't start. One with no default export fails the run with a message
  that names the fix.
- **One L10 for cases and examples.** `captureAt(context, request, location)` in
  `@unframework.dev/testing/node` holds the policy and the comparison. A `CaptureLocation` says
  where the baselines are, where the reference publishes its live capture, where a failure's
  images go, where every capture goes, and which command writes the baselines. The corpus's
  `ufVisualCapture` builds a case's location, as before. The browser half, `captureVisual`, takes
  the command it sends to, and is exported from `./harness`.
- **The runner reuses the project's browser projects.** `unframework visual` writes one case per
  example under `.unframework/specs/`: a spec that mounts the example and captures it, and a
  `case.json` whose `main` is the example (ADR-0086). It takes the `browser:<target>` projects
  of `defineTestConfig`, adds the `ufExampleCapture` command and the run's context, and runs
  them in-process with Vitest. The reference runs first, as in a project's tests.
- **Baselines live beside each example:** `__screenshots__/<name>-chromium-linux.png` and
  `__expected__/geometry.<name>.json` in the example's directory, as a case keeps them in its own.
- **Live by default.** Every target compares with the reference's capture in the same run, in CI
  too (ADR-0086). `--baseline` compares with the committed files, and a missing one fails
  `missing-artefact`. `--update` writes them, and only in the baseline environment
  (`BASELINE_ENVIRONMENT`), as L10 does. Elsewhere it's refused before the run starts.
- **The run directory**, `.unframework/visual/` by default (`--out`), holds `report.json` and
  every capture: `<example id>/<target>.png` for each cell, and for a failure
  `<example id>/<target>/` with `reference.png`, `actual.png`, `diff.png` and
  `geometry.actual.json`. A run empties it first, so it refuses a directory that holds the project,
  or one with files no earlier run marked as its own.
- **`report.json` is versioned (`version: 1`)** and typed as `VisualReport`: the pixel mode, the
  reference, the targets and, for each example and target, the status, the outcome, the message,
  the pixel count, every geometry delta and the image paths, relative to the report. A cell with
  no capture fails as `not-captured`, with its test's error. A follower whose reference never
  finished the example fails too (ADR-0091): the report never shows a cell as passed that
  compared nothing.
- **`unframework visual [--target <t>]… [--baseline | --live] [--update] [--out <dir>]`** is
  registered by the umbrella, as `test` is (ADR-0086), with `@unframework.dev/visual` as another
  optional peer. It prints a line per example and the report's path, and exits 0 when every cell
  passes, 1 when one fails or UF7011 stops it, and 2 on a usage or configuration error.
- **`unframework build` and `check` skip examples under `srcDir`.** An example is never a
  source to package, even beside the component it shows.

## Consequences

**Positive:**

- A design system checks its components' pixels on seven targets from files it already writes as
  documentation, with no baseline image to start.
- The corpus's L10 and a project's examples are one code path, so a fix to the comparison reaches
  both, and the corpus proves the code users get.
- Every capture leaves an image, so the HTML report (M7's P4) can show all seven side by side.

**Negative:**

- Live pixels compare one target with another on one machine. They catch a difference between
  targets, never a change to every target at once, which only baselines catch.
- Examples render in the bundled Inter: the font audit fails a capture whose text uses any other
  font, so an example can't show a design system's own typeface yet.
- The run writes generated specs under `.unframework/specs/` in the project, which it must
  ignore in Git.

**Open:**

- The HTML report is M7's P4, and `unframework preview` its P5.
- Interaction states (a hover, an open menu) need a step before the capture, which an example
  doesn't have.

## Alternatives considered

- **A runner of its own, outside Vitest.** ADR-0083 measured one and kept Vitest. A second runner
  would duplicate the determinism, the mount adapters and L10.
- **Examples with props, given in a sidecar file.** An example with no props is portable by
  construction (plan §8.6), and a case with `ssr` scenarios already covers a component's props.
- **Baselines under the run directory.** The run directory is scratch that a run empties, and a
  committed baseline belongs beside what it describes, as a case's does.
