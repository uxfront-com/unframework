# The integration corpus

This is the verification machine of plan §7. Every case is a `.uf.tsx` input, or a main input
with its children and harness parents, compiled to all seven targets, and every output is checked
by the same expectations: one expectation, verified seven times. A feature is done when its cases are green on every target, not when it emits code.

```sh
pnpm test                 # everything, from the repo root (turbo); or, in this package:
pnpm --filter @unframework/integration test -- --project "browser:vue"   # a subset
pnpm test:update          # rewrite the golden outputs and the shared expectations (never in CI)
pnpm test:baselines       # rewrite the Linux screenshot baselines, in Docker
pnpm test:baselines:download   # or copy in the ones CI generated for this branch (or a <run-id>)
pnpm test:baselines:check # compare the browser projects with them, as CI does, in Docker
pnpm test:canaries        # prove that every live layer catches the corruption it exists for
pnpm test:canaries L8     # the canaries of one layer, or name canaries by id
pnpm test:canaries L8 --shard 1/2   # a part of the cases, as CI runs a browser canary (ADR-0052)
```

## A case

```
cases/basics/hello/
├── Hello.uf.tsx                       the input
├── hello.test.ts                      the browser spec, written once and run on every target
├── case.json                          optional: { description, main, ssr: { <scenario>: { props } }, axe: [rule ids], requires: why, reference, colorScheme }
├── __output__/
│   ├── ir.json                        the IR snapshot, validated against @unframework/ir's schema
│   └── <target>/<files>               the golden outputs: formatted, reviewed, checked in place
├── __expected__/                      shared by all seven targets
│   ├── diagnostics.json               the expected diagnostics ([] when there are none)
│   ├── ssr.default.html               the normalised server HTML of each SSR scenario
│   ├── dom.initial.html               the normalised client DOM of `expectParity("initial")`
│   ├── aria.initial.yaml              its accessibility tree
│   ├── trace.after-click.json         the steps that led to `expectParity("after-click")` (L9)
│   └── geometry.initial.json          its geometry and computed styles (Linux)
└── __screenshots__/initial-chromium-linux.png   its pixels (Linux)
```

A diagnostics case (`cases/diagnostics/*`) has no spec: its `__expected__/diagnostics.json` lists
the diagnostics, and `__output__/diagnostics.txt` is the code frame people and agents read.

The browser projects run every case in the light colour scheme. A dark-theme case opts in with
`"colorScheme": "dark"`: the setup file emulates `prefers-color-scheme: dark` before the spec
mounts anything, and the startup check asserts it (ADR-0061). A case may also hold `.css` files
beside its inputs; the loader reads them as neither inputs nor specs, and a stylesheet a target
emits is a golden file under `__output__/<target>/` like any other. The toolchain projects leave
emitted `.css` files out of what L3, L4 and L5 check; the compile project parses each with
lightningcss instead (ADR-0063).

### Composables and shared modules

A case may hold `.uf.ts` composables and plain `.ts` modules beside its `.uf.tsx` inputs (ADR-0069,
ADR-0070). It still needs a `.uf.tsx`: the main input is a component.

- A `.uf.ts` is a source like a `.uf.tsx`: the compile project compiles it to every target
  (`compile()` takes one from M5's composables on), its IR snapshot is
  `__output__/ir.<Stem>.json` (`ir.useToggle.json`), and its outputs join `__output__/<target>/`
  (`useToggle.ts`, Svelte's `useToggle.svelte.ts`, Angular's `use-toggle.ts`). A `.uf.ts` and a
  `.uf.tsx` of one stem would share a snapshot, so the loader refuses them.
- A `.ts` module that is not the spec is no compile's input. The compile of each source that
  imports it copies it into `__output__/<target>/` at its own file name (ADR-0070, from M5's
  shared modules on), and L2 fails a copy that is not the module byte for byte.
- The toolchain projects hand every emitted file but a sheet to L3, L4 and L5, the `.ts` and
  `.svelte.ts` modules included. On Vue, Svelte and Astro, L3 runs Vite's TypeScript transform
  over a `.ts` module, where no framework compiler reads one, and Svelte's `compileModule` after
  it over a `.svelte.ts`; ESLint reads only the template files and the `.svelte.ts` modules. Vue's
  L3 gives `compileScript` the output tree, so `defineProps<X>()` resolves an `X` imported from a
  `.ts` module or another `.vue` file (ADR-0067).
- `tsconfig.cases.json` type-checks the `.uf.ts` and `.ts` sources with the `.uf.tsx` ones, the
  specs left to `tsconfig.json`.

### A case of several sources

A case may hold several `.uf.tsx` inputs (ADR-0057): a component and its children, or a harness
parent that composes the component under test. `case.json` then names the main one, the one the
spec mounts and the SSR scenarios render: `"main": "Form.uf.tsx"`. A case of one input needs no
`main`.

A case Vue has no output for, because it requires a capability Vue's cell leaves unsupported
(`listbox`), names the target that writes its expectations instead: `"reference": "react"`
(ADR-0057). The compile project checks that Vue declares the capability unsupported and the named
target native; the named target's projects run after Vue's and before every other target's, and
`pnpm test:baselines` takes the case's pixels from it (`semantics/listbox`).

```
cases/components/form/
├── Form.uf.tsx                        the main input ("main": "Form.uf.tsx")
├── Field.uf.tsx                       a child (or a harness parent)
├── form.test.ts
├── case.json
└── __output__/
    ├── ir.json                        the main input's IR snapshot
    ├── ir.Field.json                  each other input's, named by its file
    └── <target>/<files>               every input's outputs, each file named by its component
```

- Every input compiles to every target. Their outputs share `__output__/<target>/`, so two
  components of a case may not have one name on any target, and the compile project fails a
  golden file that no input produces.
- `__expected__/diagnostics.json` holds every input's diagnostics, each with its `file`, sorted by
  file, then by span; `__output__/diagnostics.txt` frames them by file.
- The golden guard judges each module the browser and SSR projects compile on the files that
  compile produced, so a child is judged against its own files.
- The spec imports the main input only, and a mount listens to the main component's events. A
  test that needs slots, children or a model does not pass them as mount options: it mounts a
  harness parent, written in `.uf.tsx` as an input of the case, which passes the slot content,
  binds the models, listens to the child's events and renders what it holds
  (`<output>{text.value}</output>`). The spec asserts on what the parent renders, and on
  `view.emitted` of the parent's own events. The parent exercises each target's consumer
  output, which a mount option would bypass.
- The browser and SSR projects load a child by the import its parent's output writes
  (`./Field.vue`, ADR-0053). The unplugin resolves that import from the parent's compile, to the
  child's module, and watches the child's file for the parent. Angular's ngtsc step resolves and
  loads each child before it compiles the parent, and Astro's render server asks the browser
  project to resolve and compile it, since the browser imports only the main component.

The `.html` expectations use the canonical format of `@unframework/testing/normalize`: one node
per line, JSON-quoted text and attribute values, and form-control state as `uf:*`
pseudo-attributes. The normaliser removes framework noise, and only the target's own (ADR-0031):
every comment, which frameworks use as anchors; the attributes its framework adds, such as
`_ngcontent-*`, `q:*`, `data-hk` and `data-astro-cid-*`; Angular's `uf-*` host elements with
`display: contents`; Qwik's `q:template` elements, where its server render keeps a slot's
unclaimed fallback (ADR-0058); and Qwik's `<style q:style>` elements, where its server render
writes a component's `useStyles$` sheet, which its client writes in `<head>` (ADR-0063). For every target, the reference included, it also writes one form of what
renders alike however it is written:

- attributes sorted by name, and a `class`'s tokens sorted, one space apart;
- a `style` in the CSSOM's format, its declarations sorted by property unless the order of two
  of them decides what renders (ADR-0044);
- no `class` without a token, no `style` without a declaration, and no declaration with an empty
  value (ADR-0044);
- a boolean attribute's value written empty (`disabled="disabled"` is `disabled=""`), and on
  Qwik, whose client writes a boolean that is on as `="true"`, that value too (ADR-0044);
- no markup of a form control's initial state where its live `uf:*` state says the same: an
  `<input>`'s `value` that equals its `uf:value`, its `checked` where `uf:checked` is `"true"`, an
  `<option>`'s `selected` where `uf:selected` is `"true"`, and a `<textarea>`'s text that equals
  its `uf:value`. react-dom and Astro write the initial state as markup where Vue sets the
  property, and the state compares in `uf:*` (ADR-0058);
- the compiler's generated ids renumbered `uf-id-1`, `uf-id-2`… by first appearance wherever they
  appear: every attribute value and text node, and the ARIA tree and payloads with them;
- whitespace collapsed as Chromium renders it, and kept as written where the model cannot tell
  (around a table-internal box in an inline box, for one).

Nothing else is normalised. Markup the HTML parser would repair is an error, not a difference to
smooth over; adjacent text nodes read as one text, as HTML cannot tell them apart (L10's capture
merges them too, ADR-0044). The details are in `packages/testing/README.md` (Normalisation).

### Adding one

1. Create `cases/<area>/<name>/<Name>.uf.tsx` and, unless it is a diagnostics case,
   `<name>.test.ts`. The area, the name and every scenario (of `expectParity` and of
   `case.json`'s `ssr`) are kebab-case (`KEBAB_CASE` in `@unframework/testing/node`): words of
   `a-z` and `0-9` joined by single hyphens, such as `after-click`. A spec:

   ```ts
   import { describeTargets, it, mountScenario } from "@unframework/testing";
   import { expect } from "vitest";

   import Counter from "./Counter.uf.tsx";

   describeTargets("state/counter", () => {
     it("renders the initial count", async () => {
       const view = await mountScenario(Counter, "initial"); // case.json's ssr.initial.props
       await view.expectParity("initial");
       await expect.element(view.getByRole("status")).toHaveTextContent("2");
     });

     it("increments and emits the new value", { requires: ["interactivity"] }, async () => {
       const view = await mountScenario(Counter, "initial");
       await view.user.click(view.getByRole("button", { name: "+3" }));
       await view.expectParity("after-increment");
       await expect.element(view.getByRole("status")).toHaveTextContent("5");
       expect(view.emitted("change")).toEqual([[5]]);
     });
   });
   ```

   Write each spec by these rules (ADR-0043, ADR-0050); the canaries depend on them, and the
   compile project checks the ones a spec's text shows (`specProblems` in `harness/cases.ts`):
   - Each test calls `expectParity` (after its interactions, if it has any), then asserts at
     least one positive fact about what it rendered, through the view's queries (`getByRole`,
     `getByText`, …): text or a role that is there, not only one that is absent. Emits are
     checked with `view.emitted`/`view.events`. A test without an assertion fails L8
     (`requireAssertions`). The L8 canary, which renders nothing, must fail L8 on every spec and
     target, but it judges the (case, target) cell, which fails when any of the case's tests
     does: a test that asserts only absences passes against the empty render unseen beside one
     that fails. This rule, not the canary, keeps such a test out. A test that requires nothing
     asserts first through a locator (`await expect.element(view.getBy…)`, or `expect.poll`):
     against the empty render it then fails as a query that finds nothing, the canary's evidence,
     on Astro too, where no action of another test fails first.
   - A test asserts after `expectParity`: between a step (a `view.user` action, a
     `view.rerender` or a `view.clock.tick` of a mounted view) and the `expectParity` that
     compares it, it asserts nothing (`expect`, `expect.element`, `expect.poll`), and it ends
     with no step uncompared. Steps in a row may share one `expectParity`, unless a step acts on
     what an earlier step's handler alone renders, or follows a submission or a link that a
     handler must prevent: then the earlier step gets its own `expectParity` first. Either way a
     step whose handler is missing fails L9, which compares its trace, before a later action or
     assertion can abort the test; the L9-unwired-handler canary depends on it, and judges the
     second half. The compile project checks the first (`specProblems`).
   - A test whose expectations depend on client code declares `requires: ["interactivity"]`
     (and any option capability it relies on): an action, an emit, a mounted state that a
     lifecycle hook, a watcher or `watchEffect` changed, or state or consts surviving a
     rerender. On a target whose cell is unsupported (Astro) it is skipped, and the skip is
     recorded on every browser layer and listed in the matrix.
   - At least one test of a case checks a scenario before it acts, and requires nothing, unless
     the case's mount-time client code changes the DOM: then every test requires
     `interactivity`, the server render (L6) checks Astro, and `case.json` says why in its
     `requires` note.
   - A case that a target has no output for (it expects the error that target declares for a
     capability it lacks, a UF4xxx) still loads its spec in that target's browser project,
     against a stand-in for the component (`harness/no-output.ts`), and every one of its tests
     is skipped there, whatever it requires, with `no output: <the expected errors>`: a
     mechanical cause, which the summary excuses on that target alone. Its tests require only
     what they use, so a static test requires nothing and the other targets, Astro included,
     check it.
   - A spec acts only through `view.user` (`click`, `dblClick`, `tripleClick`, `hover`,
     `unhover`, `fill`, `type`, `clear`, `keyboard`, `tab`, `focus`, `selectOptions`, `wheel`):
     never `userEvent`, `page` or a locator's own actions, which skip the adapter, the settling
     and the trace.
   - Timer cases use `view.clock`: a test whose component starts an interval mounts with
     `{ clock: true }`, which fakes `setInterval` and `clearInterval` before the component
     mounts, and moves time only with `view.clock.tick(ms)`, a step of the trace holding what
     the intervals did (`lifecycle/unmount-timers`). A real interval would fire inside a step on
     a loaded machine and after it on another. Any other timer runs in real time: a spec that
     waits for it asserts with `expect.poll`, a fixed wait only proves that nothing more happens
     (after an unmount), and no `expectParity`, step or action comes while such a timer that
     changes the DOM or emits can fire: it starts from an action after the first
     `expectParity`, and stops (or the view unmounts) before the next.
   - A DOM read that feeds state or an emit reads what layout does not decide (`textContent`,
     attributes, `value`, `document.activeElement`), never geometry: the expectations are
     written on macOS and compared on Linux.
   - No spec reorders a list, or replaces a row's item, while the focus is inside the list.
   - A spec never branches on the target: one expectation, verified seven times.
   - Each test names its own scenario: unique in the case, with a string literal; and each test
     has a name of its own in the case, by which the summary compares the targets' tests.
   - A scenario with a server twin mounts with `mountScenario(Component, name)`, which takes the
     props from `case.json`, so the server and the browser render the same props. A
     browser-only scenario (an explicit `undefined`, which JSON cannot carry, or a `rerender`)
     says so in a comment and mounts with `mount(Component, { props })`, typed by the
     component's props.
   - No hooks: each test mounts what it checks, and the setup's own `afterEach` records L8 and
     L13.

2. Run `pnpm test:update`. The compile project writes `__output__` and
   `__expected__/diagnostics.json`; the reference target (Vue, decision D10) writes the shared
   expectations, and every other target is compared with them in the same run.
3. Push, and once CI's `Baselines` job has run, `pnpm test:baselines:download` copies in the
   Linux screenshots and geometry it generated. `pnpm test:baselines` makes the same files
   locally, in Docker.
4. Review every new file as carefully as code: the expectations are the contract.

## The layers

| Layer | Project               | What it checks                                                                                                                                                                                                                                           |
| ----- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1    | `compile`             | The diagnostics equal `diagnostics.json`: no internal error (UF9xxx), and in a case with a spec no error but one a target declares for a capability it lacks. Every fix applies and recompiles clean, but for what the target's capability cells report. |
| L2    | `compile`             | The IR and the outputs equal `__output__`, byte for byte, with no stale files; compiling twice gives the same bytes; formatting is idempotent; every emitted sheet parses.                                                                               |
| L3    | `toolchain:<target>`  | Each output passes its framework's own compiler with zero warnings.                                                                                                                                                                                      |
| L4    | `toolchain:<target>`  | Each output type-checks under one strictness for all seven checkers, one run per target over every case; a tsconfig problem fails every case. The case's consumer fixtures fail exactly where their directives say (below).                              |
| L5    | `toolchain:<target>`  | Each output passes oxlint's shared baseline rules and its framework's lint rules with zero warnings; rules that judge the author's code are off.                                                                                                         |
| L6    | `ssr:<target>`        | The server render equals `ssr.<scenario>.html`.                                                                                                                                                                                                          |
| L7    | `browser:<target>`    | The client DOM and the ARIA tree equal `dom.<name>.html` and `aria.<name>.yaml`.                                                                                                                                                                         |
| L8    | `browser:<target>`    | The spec's own assertions pass: what it rendered, what a rerender with new props changes, what its actions change and the events it emits.                                                                                                               |
| L9    | `browser:<target>`    | After every action and rerender, the normalised DOM, the ARIA tree and the events emitted equal the steps of `trace.<name>.json`.                                                                                                                        |
| L10   | `browser:<target>`    | Geometry and computed styles first, then pixels, with zero tolerance by default.                                                                                                                                                                         |
| L11   | `browser:<target>`    | axe-core reports no violations, or exactly the case's `axe` list.                                                                                                                                                                                        |
| L13   | `ssr:` and `browser:` | No `console.warn` or `console.error` during render or mount.                                                                                                                                                                                             |

**L4's consumer check** (ADR-0059). A case may have consumer fixtures per target, hand-written in
that target's language under `../toolchains/<target>/consumers/<area>/<case>/`: one correct
consumer, which must check clean, and one fixture per misuse of a prop, an event, a model or a
slot, or of a type the component's module exports (ADR-0068). A misuse carries a directive on the
line before it, `// @uf-expect TS2322 Field.prop:label` or `// @uf-expect TS2322
Button.type:ButtonProps` (an HTML comment in markup), and the same checker run as L4 judges it in
the case's L4 cell (`harness/consumers.ts`): every directive must be met by a diagnostic with its
code on the next line, any other diagnostic fails, and a directive's declaration must exist in the
case's IR. A failure names the declaration's line from its IR span: its `.uf.tsx` line, or for a
type re-exported from a case's `.ts` module, its line there (`types.ts:2`). A kind a target cannot
check is declared in `CONSUMER_GAPS`, with its reason, and a directive of that kind fails; so is a
finer part of one, a slot without props (`named-slot`) or a slot whose props name a type parameter
of its component (`generic-slot-props`), which leaves the target's other slots checked. The
`L4-consumer` canary types every output's props, events and slots `any`, so every directive must
go unmet. `../toolchains/README.md` has the layout and the notes per checker.

Each test records its layers in its task meta: `expectParity` records L7, L9, L10 and L11
without throwing, so the assertions after it always run, and the setup's `afterEach` records L8
from the test's own errors (and L9 for a step no `expectParity` compared), then fails the test
with every failed layer. A test skipped by capability records the skip on every browser layer
before it is skipped; the matrix (version 5) also keeps each test's scenarios and capability
skip by the test's name, which the summary compares and lists. The parity reporter writes
`.reports/parity-matrix.<run>.json`; `pnpm --filter @unframework/integration summary` merges them
into `parity-matrix.json` and `parity-matrix.md` (CI's job summary). `UF_BROWSER=firefox` or
`webkit` runs the browser projects in that engine (ADR-0066): L10 compares each target with the
reference's capture from the same run, nothing is written, and the matrices go to `.reports/<engine>/`, merged
into `parity-matrix.<engine>.json` and `.md`. The nightly workflow runs both engines; a
difference there is an issue, never a quarantine entry. A cell is `pass`, `fail`,
`skip(reason)` or `quarantined(issue)`; a skip on a live layer names a capability the target
lacks (`requires interactivity: …`) or a mechanical cause (no output, the live reference, a
component that did not render, no scripted interaction). A project that collects no tests fails, and when every
project ran, a missing cell fails. A project ran when an unfiltered run, or every shard of one
(`--shard 1/n` to `n/n`, of the same projects and nothing else filtered), ran it; a file or
test-name filter, or a missing shard, makes a partial run. In CI the summary is the parity job,
which requires every job's matrix; `pnpm test` summarises the projects it ran, so a run of some
of them (`--project`, `pnpm test:baselines:check`) is a partial run.

## The rules that keep it honest

- **Check mode never writes.** A missing artefact fails with the command that creates it. CI is
  always in check mode, and `pnpm test:update` refuses to run there.
- **One expectation, written once.** In update mode only the reference target writes the shared
  expectations; the others must match what it wrote in the same run (`sequence.groupOrder` runs it
  first).
- **The browser runs the reviewed code.** A guard fails any module whose compiled output differs
  from its committed golden file. A mount listens to the events the main module the project
  compiled declares (the unplugin reports every compile; `ufComponentEvents`), never to a committed IR an
  update run has not written yet. A module that fails to compile fails its own spec's import
  only: the browser projects send Vite's error to no page, whose overlay would cover the page
  every later spec clicks in.
- **Only pixels and geometry are Linux's.** `pnpm test:baselines` runs the reference alone and
  fails when a DOM, ARIA tree, trace or server HTML expectation reads otherwise in the container
  than in the repository: those are written by `pnpm test:update` wherever it runs, and must not
  depend on the platform.
- **Pixels are Linux's.** The committed PNG and geometry come from `pnpm test:baselines`, in the
  same Playwright image the CI browser jobs use, on linux/amd64: the container exports
  `UF_BASELINE_ENVIRONMENT`, and no other environment may write them. The container sees the
  repository read-only. Once it stops, the script takes the baselines that changed out of it
  and copies only regular files at a baseline's path into the repository; anything else there
  refuses the copy. Elsewhere, every target is compared with the Vue capture from the same run (live mode),
  and nothing visual is written.
- **CI generates them too (ADR-0062).** On every pull request, the `Baselines` job runs the same
  update in the same image on a real x64 runner, without Docker, and uploads the baselines that
  changed or are new as the `baselines` artefact. It never commits, and it uploads nothing when
  nothing changed. `pnpm test:baselines:download [<run-id>]` takes the artefact of a run (by
  default the current branch's latest), through the same filter, and copies it into the cases.
- **No stale expectations.** Every file under a case's `__expected__` and `__screenshots__`
  belongs to its diagnostics, an SSR scenario of its `case.json`, or an `expectParity` scenario
  of its spec (named with a string literal, so the harness can read it). The compile project
  fails on any other file, and `pnpm test:update` deletes it.
- **Canaries.** `pnpm test:canaries` corrupts the compile in a way one layer exists to catch,
  mostly with a compiler plugin (an unexpected diagnostic in every source, a throwing plugin, an
  IR change, an edited output file, output that differs between two compiles, unformatted
  output, a mismatched closing tag, a type error, a `debugger` statement, an idiom the
  framework's lint rules forbid, wrong text, a render of nothing, element listeners removed on
  the cases whose specs act, wrong text on the cases whose specs rerender, a hidden root,
  inverted colours, an invalid ARIA role, a console warning), with a fix that fixes nothing (corrupted by
  the harness, on the cases whose diagnostics have a fix), and with one that only the golden
  guard can catch, in the server render and in each browser spec's import. The run fails unless
  every canary is caught by its own layer on every case and target it corrupts, in each
  sub-check it names: the diagnostics (the diagnostics cases' too) and their fixes, the IR
  snapshot and the golden files, determinism and formatting, the baseline lint rules and the
  framework's, the DOM and the ARIA tree, the spec's assertions, the traces, geometry and pixels,
  the server's console and the page's. Each kind of project is judged on its own cells (the
  server's console proves nothing of the page's), and only on the tests that ran: a browser
  project proves nothing of a case none of whose tests runs on its target (each skipped by a
  capability it requires), and a canary of the tests that act or rerender is judged only where
  such a test runs. A cell a target skipped by capability ran nothing to corrupt, and is excused
  like a quarantined one; a target on which the canary applies to no case (Astro, for the
  cases whose tests act) is not judged, and the run says so. A canary changes only what every render shows
  and keeps the IR valid; the harness's unit tests run each one on every case of the corpus it
  applies to. CI runs the
  canaries as a matrix, a layer or a canary per job, with at most one canary that runs the
  browser projects in each. A canary whose browser specs run waits out a timeout at most of
  their failures, so it runs in shards (`--shard 1/2`, ADR-0052): each holds a part of the cases,
  runs its specs in the browser projects and every other project whole, and is judged on its
  cases alone.
- **Qwik's listeners run as they do once each has run, and none is ordered by the harness.** A
  Qwik handler, task or local function runs once its QRL has resolved, and a QRL resolves on its
  first run, through the `import()` of its segment, which the browser answers in a later task,
  even when Qwik's preloader (`@qwik.dev/core/preloader`) has fetched it: the preloader only
  fetches bundles (`<link rel="modulepreload">`). Once resolved, a QRL runs inside the dispatch,
  and the listeners run in the DOM's order. The Qwik browser project checks that state, which
  the contract covers (ADR-0050): before the component renders, and again before each input of
  an action, its adapter loads every segment the component's QRLs reference and resolves the
  QRLs (`@unframework/target-qwik/toolchain`, `loads.ts`). It never orders an import: one it did
  not preload is handed over as the browser answers it. So no browser test sees a listener's
  first run, which the contract declares instead (ADR-0050, the semantics page's "Outside the
  contract"): until its code has loaded, a listener runs after the event's dispatch, so it reads
  the DOM after the event's default action (a Backspace has emptied the field), finds the data
  an event carries only while it is dispatched gone (`clipboardData`, `dataTransfer`), and its
  controls do nothing; and the listeners of one input run in the order their code arrives,
  which the page does not decide. Of these, the controls are reported: a `preventDefault()`,
  `stopPropagation()` or `stopImmediatePropagation()` that the body of a `$` function calls on
  its event while the event is dispatched is logged on the console (L13), since on a first run
  it would come too late; Qwik runs controls at dispatch (`sync$`, `preventdefault:click`).
- **The quarantine only shrinks.** `harness/quarantine/<target>.ts` lists a target's known
  failures, each with a reason and an issue, so each target's work edits its own file
  (ADR-0057); `harness/quarantine.ts` joins them, refuses an entry filed under another target,
  and holds `LIVE_LAYERS` and the entries' validation. A quarantined cell still runs and must
  still fail; once it passes, the entry is stale and fails the run until it is removed.
- **The coverage gate.** Every kind of the IR's coverage records (render nodes, attributes,
  bindings, setup items, handlers, watch sources and the references of setup code), every
  capability a target supports and every catalogued diagnostic code needs a case
  (`harness/coverage.ts`). `harness/coverage-exemptions.ts` excuses the ones that have none yet,
  each with a reason; an exemption that the corpus covers fails the gate.

## Where things live

- `harness/projects.ts`: the Vitest projects (`compile`, `harness`, and `toolchain:`, `ssr:` and
  `browser:` per target). `UF_TARGETS=vue,react` restricts the targets; a target a case names as
  its own reference (`"reference"`, ADR-0057) still runs that case alone (`referencesOnly`).
- `harness/cases.ts`: the corpus, each case's inputs (its `.uf.tsx` and `.uf.ts` sources and its
  `.ts` modules), its main one and its `case.json`;
  `sources.ts`: how a case's inputs join their diagnostics and golden files.
- `harness/compile.test.ts`, `toolchain.test.ts`, `ssr.test.ts`: the node-side layers;
  `compile-checks.ts`: L1's fix check, L2's determinism and formatting checks, and the scoped
  sheets' parse; `toolchain-results.ts`: what L3, L4 and L5 make of each tool's report, and the
  files they check; `consumers.ts`: L4's
  consumer check and `CONSUMER_GAPS`.
- `harness/engines.ts`: the styling engines every ssr and browser project loads, and Astro's
  render server too (ADR-0064): Styleframe, and `harness/fixture-engine.ts`, an engine of a few
  lines with no dependency, whose `virtual:fixture-engine` modules the `engines/fixture-engine`
  case imports, typed by `fixture-engine.d.ts`.
- `styleframe.config.ts`: the Styleframe configuration of the `styleframe/` and `theming/`
  cases, Community only (ADR-0064). `harness/styleframe.ts` loads Styleframe's plugin with it in
  every ssr and browser project, and gives the checkers `styleframe.d.ts`, the declarations
  Styleframe writes for it (`pnpm test:update` rewrites them). `harness/styleframe.unit.test.ts`
  builds it for production with no licence key (`scripts/styleframe-build.ts`), and a
  configuration flagged as Pro fails the same build.
- `harness/no-output.ts`: the browser projects' stand-ins for the components a target has no
  output for.
- `harness/canaries.ts`, `canary-verdict.ts`, `load-failures.ts`: the canaries, how
  `pnpm test:canaries` judges each run, and the specs a canary run could not load.
- `@unframework/testing`: `describeTargets`, `mount`, `expectParity`, the normaliser, the write
  policy, the visual capture and the parity reporter.
- `@unframework/target-<name>/toolchain`: each framework's Vite plugins, mount adapter (with its
  rerender), server renderer, compiler check (L3), type check (L4) and lint (L5).
- `../toolchains/<name>`: the checkers and tsconfigs that type-check each target's outputs,
  with TypeScript 6 where a checker still needs it, and the lint configurations:
  `output.oxlintrc.json` for every target (not `.oxlintrc.json`, which the repository's own
  lint would pick up), and `eslint.config.js` for the template languages (Vue, Svelte, Astro,
  Angular). Qwik's type-aware rules run in ESLint from `../toolchains/qwik-eslint`, a lint host
  on TypeScript 6 that `../toolchains/qwik` installs: typescript-eslint cannot load the
  TypeScript 7 its tsgo needs. The harness passes them explicitly, since the outputs it lints
  sit outside the toolchain directories (ADR-0042).
