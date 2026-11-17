# @unframework.dev/visual

Visual parity and the preview for a project's examples (plan §8.6, ADR-0087, ADR-0088). It finds every `*.example.uf.tsx`
file, renders each on every target in Chromium, and compares each target's geometry, computed
styles and pixels with the reference target's, live or against baselines committed beside each
example. Each run writes `report.json`, an image of every capture and `report.html`, a page that shows
them.

`unframework preview` shows every example and component side by side on every target while you
work, and `unframework preview build` writes the same as a static site (below).

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

Each example also has a `category` and a `title`, which `discoverExamples` derives from its path
(ADR-0110): the directory's name in title case, or its parent's when the directory is `examples`,
and the file name in words without the category's own words in front, so
`src/components/button/examples/ButtonColors` is `Colors` in `Button`. An example at the root, or
in a root `examples/`, is in `Examples`.

The preview's catalogue reads the doc comment on each example's default export
(`readExampleMetadata` in `src/examples.ts`): its text is the `description`, and `@category` (groups
split on `/`), `@title` and `@order` (a finite number) override the derived values. It reports
UF7012, a warning, at each tag that's empty, not a number or given twice, for which the example
keeps the derived value. The preview sorts the examples by `order`, those without one last, then by
title, then by id. `unframework visual` never reads the comment, so it changes no capture and no
report.

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
   beside it (`renderReport`), and prints a line per example, then the paths of `report.json`
   (`report:`) and `report.html` (`page:`).

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

## The preview

`unframework preview [--target <t>]... [--port <n>]` (`./cli`'s `preview`) runs `startPreview`,
prints the shell's URL and each target's origin, and runs until SIGINT or SIGTERM, then closes
every server and exits 0. It exits 2 on a usage error, nothing to show or a configuration that
won't load. The docs page is `apps/web/content/docs/4.tooling/7.preview.md`.

`startPreview({ root, targets?, port?, toolchainDirs? })` resolves to `{ url, frames, diagnostics, close }`
once every server listens (ADR-0088), where `diagnostics` holds UF7012 for each malformed tag in an
example's doc comment, which the command prints to stderr:

- **One Vite dev server per target** (`src/preview/servers.ts`), on `127.0.0.1` and a port the
  system picks: the preview's plugin, the unframework plugin and the target's `vite("browser")`
  fragment (`loadToolchain` from the testing package's `./config`), then the project's `vite`
  config for `mode: "preview"`, merged in with the testing package's `withProjectVite`, its
  plugins first (ADR-0104). The toolchain gets the pass-through declarations and the project's
  plugins. `targetServerOptions` reads the config, and `targetServerConfig` builds a server's
  configuration without starting it. That plugin serves the frame
  page at `/__uf/frame`, its module, which mounts the selection with the target's adapter
  (`toolchainClientFile`) and loads each entry lazily, and an empty `vitest/browser`. A target
  that renders on the server (`renderCommandName`, Astro's) gets `POST /__uf/render`, which runs
  the command and which the frame passes to the adapter as `MountOptions.renderCommand`. Vite's
  `oxc` transform is set so Analog's Angular plugin leaves it on, and each server's cache is
  `node_modules/.vite/uf-preview-<target>`. The package is kept out of pre-bundling.
- **The shell** (`src/preview/shell.ts`) is a static page served at `/` on `port`, any free one
  by default, with no build and no dependency. Its sidebar holds two ARIA trees with a filter: the
  examples by category and the components (`readCatalogue`: the default export of each `.uf.tsx`
  under `srcDir`). Its canvas shows one labelled iframe per target, all or one at a time, and a
  docked panel holds the controls. It keeps the selection in the URL's hash, follows
  `prefers-color-scheme`, and keeps a theme the reader picks in `localStorage`.
- **The protocol** (`src/preview/protocol.ts`): the shell sends `render` messages, `{ seq, entry,
props }`, and each frame (`./frame`, `src/preview/frame.ts`) answers `ready` on load and
  `rendered` or `failed` with the `seq`. Each side checks the other's origin and window.
- **Controls** (`src/preview/controls.ts`, `propControls`): `boolean`, `string`, `number` and a
  union of string literals, as written or resolved from an alias (`ApiMember.literals`), with
  `| undefined` read as optional. Any other prop is listed as not controllable, with its type.
- **`close()`** stops the shell and every target's server, then what a toolchain's commands
  started (`toolchain.close`, Astro's render servers). A start that fails closes what it started, and its error names each reason with the targets it stopped (`startFailure`), once for the targets that failed alike.

## The static build

`unframework preview build [--target <t>]... [--out <dir>]` runs `buildPreview`, prints its
`diagnostics` (UF7012) to stderr as the dev path does, then the site's path and its targets, and
exits 0. It exits 2 on a usage error, an `--out` it refuses, nothing to
show, a configuration that won't load or a build that fails. The docs page's "Build a static
preview" and "Deploy" sections cover it.

`buildPreview({ root, targets?, out?, toolchainDirs? })` resolves to `{ out, targets, diagnostics }` once every
target is built and every render server closed (ADR-0111):

- **One Vite build per target** (`buildTarget` in `src/preview/servers.ts`), on the config
  `targetServerConfig` gives the dev server, into `<out>/<target>/`: the frame page as the input,
  written as `frame.html`, and its files under `assets/`. Its `base` is `/`, since Qwik's plugin
  refuses a relative one, and `experimental.renderBuiltUrl` makes every URL among the files
  relative. The preview's plugin makes the frame page's tags relative too. The builds are
  development builds (`mode: "development"`, with `NODE_ENV` set while they run), since React's
  adapter needs `act`, and the plugin makes every path under the root, or its repository, relative.
- **The shell** is `shellPage` written as `<out>/index.html`, framing `./<target>/frame.html`.
  `ShellData.frames` is `{ target, src }`: each frame page's URL, from which the shell takes the
  frame's origin. In the static site every frame shares the shell's origin, and a frame refuses a
  shell at any other origin (`FrameOptions.staticPreview`): it sends and takes no message.
- **Astro** (a target with a `renderCommandName`) is rendered at build time by
  `renderTargetEntries`, through a server in middleware mode, with each entry's initial props
  (`initialProps`: none for an example, a component's required props at their controls' initial
  values). Each render is `<out>/astro/renders/<n>.json`, a `StaticRender` (`{ props, html }`, or
  `{ props, error }` for a render that failed). The frame module mounts each entry's recorded
  reference, and the frame's `staticRenders` transport reads its file. Other props fail with
  `STATIC_RENDER_MESSAGE`.
- **`--out`** is `.unframework/preview` by default (`DEFAULT_PREVIEW_OUT`). The build empties it,
  so `checkPreviewOut` refuses the root, a directory above it, and one that isn't empty and has no
  `.unframework-preview` marker (`PREVIEW_MARKER`).

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

`project-config.test.ts` runs the fixture projects under `test/fixtures/project-plugins` and
`test/fixtures/live-fonts*`: an example that imports a module only the project's own plugin serves
passes on seven targets, a preview server's resolved plugins hold that plugin and its config
refuses the keys the server owns, and an example in the system's font fails `font-fallback`
without `liveFonts`, passes on seven targets once the list names the families that run reported,
and still fails with another family listed or against baselines.

`preview.test.ts` starts the preview on `tests/e2e/design-system`, loads the shell in Chromium and checks seven
frames from seven origins, a control that reaches all of them, and that no port listens after
`close()` or after the command's SIGINT. `preview-catalogue.test.ts` covers the catalogue, the
controls and the command's arguments.

`preview-build.test.ts` runs `unframework preview build` on `tests/e2e/design-system` once, into a
temporary directory, serves the site under `/sub/` with a server that only maps URLs to files, and
checks, in Chromium, seven frames from the shell's origin, every example rendered on every target,
Astro's frame equal to the dev preview's, and a changed prop failing Astro's frame with the static
message. It also checks the site holds no path of the machine, the command's exit 2 on a bad
argument and on each `--out` it refuses, and, on `test/fixtures/astro-throws`, a render that fails
at build time, and, on `test/fixtures/metadata`, that the command prints UF7012 and still exits 0.
