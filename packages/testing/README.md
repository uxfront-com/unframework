# @unframework/testing

The cross-target test API (plan §7.3, §8.5): one spec, written once, runs in every
`browser:<target>` project and verifies the shared expectations layer by layer. Private until M7.

```ts
// cases/state/counter/counter.test.ts
import { describeTargets, it, mountScenario } from "@unframework/testing";
import { expect } from "vitest";

import Counter from "./Counter.uf.tsx";

describeTargets("state/counter", () => {
  it("renders the initial count", async () => {
    const view = await mountScenario(Counter, "initial");
    await view.expectParity("initial"); // L7 DOM + ARIA, L9 (no steps), L10 pixels, L11 axe
    await expect.element(view.getByRole("status")).toHaveTextContent("2"); // L8
  });

  it("increments and emits the new value", { requires: ["interactivity"] }, async () => {
    const view = await mountScenario(Counter, "initial");
    await view.user.click(view.getByRole("button", { name: "+3" })); // a step of the trace
    await view.expectParity("after-increment"); // L9 compares the step with the trace
    await expect.element(view.getByRole("status")).toHaveTextContent("5");
    expect(view.emitted("change")).toEqual([[5]]);
  });
});
```

## Browser (`@unframework/testing`)

- **`mount(component, { props, clock? })`** mounts with the project's registered adapter into a
  `<div data-uf-root>` in the page's `<body>`, and returns a **`View`**: `container`, a `locator`
  (`page.getByTestId("uf-root-N")`, stable as the DOM changes), `getBy*` queries scoped to the
  container, `html()` (the normalised DOM), `settle()`, `rerender(props)`, `user`, `clock`,
  `emitted(name)`, `events()` and `unmount()`. A component imported from a `.uf.tsx` is typed as its
  authored function, so `props` (and `rerender`'s) are checked against its props type; the untyped
  overload takes what is not a function only (the test stubs).
- **`mountScenario(component, name, { clock? })`** mounts with `case.json`'s `ssr[name].props`, so a
  browser scenario and its server twin render the same props; the test then checks it with
  `expectParity(name)`. A scenario `case.json` cannot hold (an explicit `undefined`, a rerender) is
  browser-only: mount it with `mount` and say so in a comment.
- **`view.rerender(props)`** renders the component again with new props, as a parent would,
  and waits until it has settled, as `mount` does. The props are replaced whole: a prop the new
  props lack takes its default again (each adapter's `rerender`, ADR-0043). It records a step
  of the view's trace, `rerender {…props as JSON}`, as an action does.
- **`it(name, { requires }, fn)`** and **`test`** (ADR-0050): Vitest's, plus `requires`, the
  capabilities a test needs (`["interactivity"]`, typed by `CapabilityName`). On a target whose
  cell for one of them is unsupported (Astro's `interactivity`), the setup file skips the test
  before it runs and records `skip(requires <capability>: <the target's reason>)` on L7, L8, L9,
  L10, L11 and L13, and `skipped` on the test's record, so the matrix shows it and the summary
  excuses that test's scenarios on that target alone. The cells come from Node
  (`test.provide.ufCapabilities`), never from importing a target. It refuses `skip`, `only`,
  `todo`, `fails`, `retry`, `repeats`, `concurrent` and `tags`, `requires: []` and an unknown
  capability. Every test of a case the target has no output for (`test.provide.ufNoOutput`, by
  case id, with the errors it expects for the target; the harness gives its spec a stand-in for
  the component) is skipped there the same way, whatever it requires, with `no output: <the
errors>` on every layer, and the summary excuses it on that target alone.
- **`view.user`** acts as a person does, through Playwright's real input (ADR-0050). An action
  is the inputs a person gives apart in time, each dispatched alone (the `ufInput` command):
  `click(target, { position? })` moves the mouse onto the element (Playwright's hover, which
  waits until it is visible, stable and the element under the point; then a disabled element
  is refused, where Playwright's click would wait until its timeout), then presses and releases
  its main button; `dblClick` and `tripleClick` press and release it two and three times (the
  second release fires `dblclick`); `hover` and `unhover` move the mouse; `type(target, text)`
  focuses the element (Playwright's `locator.focus()`), presses and releases each key of `text`
  in turn, then releases every key still held; `keyboard(text)` presses the keys where the focus
  is (the frame, when nothing has it); `tab` presses and releases Tab, with Shift held for
  `{ shift: true }`, after focusing the frame; `fill` and `clear` focus the field, then fill or
  clear it as Playwright does, in one input; `focus` (the `ufFocus` command) and
  `selectOptions` are one input each; `wheel` moves the mouse onto the element, then turns the
  wheel `times` steps (a `direction` is 100 pixels a step, as Vitest's). In a key text, a
  character types itself, `{Enter}` presses and releases a key as Playwright names it,
  `{Shift>}` holds it (until `{/Shift}`, in this action or a later one) and `{/Shift}` releases
  it, and `{{` and `[[` type a brace and a bracket; a character Playwright's US layout lacks is
  inserted as text, with no key events, as Vitest's keyboard does. The rest of Vitest's keyboard
  syntax (`[KeyA]`, `{a>3}`), a key pressed while held or released while not held, and an empty
  text are refused before any input. Each input runs through the adapter's `interact` (React's
  `act`, Qwik's lazily loaded handlers) and settles until two rounds in a row read the same DOM
  and the same number of emits (at most ten, or L9 fails "did not settle after an input of
  …") before the next is dispatched, as the time between a person's two inputs lets a
  framework that renders in a task of its own render (Angular): dispatched back to back, two
  inputs could land before one such render, and a watcher would be called back once for both,
  or not at all, by chance. So a watcher of a field's text is called back once for each key
  typed, on every target. After the last input the action settles the same way and records one
  step: `{ action, dom, aria, events }`. Each action takes a locator under this view's root
  only (an element, the page's locator, another view's or the root itself is refused: a step
  names its target the same way on every target). An input waits the provider's action timeout
  (5 s), as an assertion waits the poll's. A key a test leaves held is released when it ends.
  On a target that runs no client code an action throws: the test should declare
  `requires: ["interactivity"]`.
- **`view.clock`**, for a view mounted with `{ clock: true }` (ADR-0050): the page's
  `setInterval` and `clearInterval` are Vitest's fakes, installed before the component mounts,
  so its intervals fire only when the spec advances the clock. `view.clock.tick(ms)`, a positive
  whole number of milliseconds, runs every interval due on the way one at a time, as real time
  would: each fires alone, in a task of its own, through the adapter's `interact`, and the view
  then settles as after an action (until two rounds read the same DOM and emits) before the
  next is due. So a framework that renders in a task of its own (React, Angular, Qwik) renders
  between two intervals, and a watcher calls back once for each; intervals due at the same
  moment run one after another, settled between them. Writes in two tasks with no render
  between them are outside the contract, and the clock never makes them. The tick records one
  step, `tick <ms>ms`, holding what every interval did. After an unmount it advances the clock
  the same way, settling the page after each interval, but records no step: `view.emitted` then
  shows what an interval the component failed to stop emitted. The tick reads the due times
  from Vitest's fake clock (`setInterval.clock`), and fails if it no longer can. More than 1000
  intervals in one tick (an interval of no time) fail it, as Vitest's own advance does.
  `Date`, `performance`, `setTimeout` and the frames stay real: no framework's
  scheduler calls `setInterval`, and Vitest's own waits keep the timers it saved at startup. The
  clock is the page's, so one view of a test may have one (a second throws before it mounts); a
  tick throws for a view mounted without one, and on a target that runs no client code. The
  setup gives the page its real intervals back when the test ends, after the unmount, so a
  teardown clears its interval on the clock that set it.
- **`view.emitted(name)`** gives the arguments of each emit of a declared event, in order
  (`[[5]]`); **`view.events()`** every emit as `[name, ...args]`. The adapter listens to exactly
  the events the component declares, which the project's own compile of the case's main source
  reports (`ufComponentEvents`; a stub registers its own). Each emit's arguments are copied as plain
  data when they arrive, after trailing `undefined` arguments are dropped (a listener cannot
  tell them from absent ones): a function, any other `undefined`, a non-finite number, a `Map`
  or `Set`, a DOM event or node, or a class instance fails the test at the next settle, naming
  the event and where in its payload. Generated ids (`uf-id-…`) are renamed as `html()` renames them,
  wherever they stand in a string. Both
  throw for an event the component does not declare, and on a target that runs no client code.
- **L9, interaction traces.** `expectParity(name)` compares the steps since the mount or the
  previous `expectParity` with `__expected__/trace.<name>.json` (the reference writes it, every
  other target must match), then forgets them. With no step, the file must not exist and L9
  records `skip(no scripted interaction)`. A step no `expectParity` compares fails L9 when the
  test ends. The file is pretty JSON, `{ "version": 1, "steps": [...] }`, each step's `dom` and
  `aria` a list of lines and its `events` grouped by name (names sorted, each name's emits in
  order: the order of different effects one run triggers is not part of the contract).
- **`view.expectParity(name, { tolerance? })`** settles, then verifies the scenario against the
  case's shared expectations: L7 (`__expected__/dom.<name>.html` and Playwright's
  `aria.<name>.yaml`), L9 (`trace.<name>.json`, below), L10 (geometry and computed styles, then pixels, through
  `ufVisualCapture`) and L11 (axe-core on the container: no violations, or exactly
  `case.json`'s `axe` list). Each layer and the scenario are recorded in `task.meta.uf`, and it
  resolves even when a layer fails, so the test's own assertions after it run too (L8); the
  setup file then fails the test with every failed layer. Only a misuse rejects (a name that is
  not kebab-case or that the spec checked already, a tolerance without a reason). No landmark wraps the mount root, so a
  component may render its own `<main>`; axe's `region` rule (all content inside landmarks) is
  off, because placing a component in the page's landmarks is the page's job.
- **L10 sees each run of text as one node.** Frameworks split one run of text into DOM text
  nodes differently (`Price: {price} EUR` is three nodes on React, Solid and Qwik, one on Vue,
  and Vue splits a text branch from the text beside it), and Chromium starts each node at a
  1/64 px edge, which moves later glyphs by a fraction of a pixel. So for the capture (geometry
  and pixels) every run of adjacent text nodes in the mount root, comments between them
  included, is merged into its first node, never across an element, then restored: the same
  nodes, with their data, so a framework's references stay valid (ADR-0044). L7 already reads a
  run as one text.
- **L10 never depends on what was repainted before it.** By default Chromium re-rasterises only
  a repainted rect, rounded out to whole pixels, over the tile's old pixels, so a control that
  starts mid-pixel takes in the anti-aliased corner of the box beside it, which then rasterises
  one level apart: the same DOM captured differently after a hover, a press or a keystroke
  repainted one control. The parity projects launch Chromium with `--disable-partial-raster`,
  which rasterises every repainted tile whole, so a capture is a function of the DOM.
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
  **`registerTarget(target, mount, { events? })`** for the per-target setup files (`events`
  reads a stub component's declared events, which no compile reports).
- **The mount contract** (`@unframework/codegen`'s toolchain types): `MountOptions.on` holds a
  listener per declared event, by the source's name, and `MountOptions.events` the events'
  payload shapes; each adapter passes the listeners as its framework's consumer would (React's
  and Solid's `onChange`, Vue's `onChange` beside the props, Svelte's `onchange`, Angular's
  `outputBinding("change")` with the payload spread back by its shape, Qwik's `onChange$` QRL,
  none on Astro) and keeps them across `rerender`. `MountedComponent.interact(action)` runs a
  user's action the framework's way.

## Writing a spec

Every spec of the corpus follows these rules, which L8, L9 and their canaries rely on
(ADR-0043, ADR-0050); `harness/cases.ts` checks the ones a spec's text shows:

- Every test calls `expectParity` (after its interactions, if it has any), then asserts at
  least one positive fact about what it rendered, through the view's queries
  (`await expect.element(view.getByText("…")).toBeVisible()`, `view.getByRole(…)`); emits are
  checked with `view.emitted`/`view.events`. A test without assertions fails L8
  (`expect.requireAssertions` in the browser projects); a test that only asserts absence
  (`not.toBeInTheDocument()`) passes even when the component renders nothing, so it proves
  nothing. A test that requires nothing asserts first through a locator (`expect.element`,
  `expect.poll`), so a render of nothing fails it as a query that finds nothing.
- A test asserts after `expectParity`: between a step (a `view.user` action, a `rerender` or a
  `clock.tick` of a mounted view) and the `expectParity` that compares it, it asserts nothing,
  and it ends with no step uncompared. A step that acts on what an earlier step's handler alone
  renders, or follows a submission or a link a handler must prevent, comes after an
  `expectParity` of the earlier step. So a step whose handler is missing fails L9 before a later
  action or assertion can abort the test.
- A test declares `requires: ["interactivity"]` (and any option capability it relies on) when
  an expectation depends on client code: an action, an emit, a mounted state that a lifecycle
  hook, a watcher or `watchEffect` changed, or state or consts surviving a rerender.
- At least one test of a case checks a scenario before it acts, and requires nothing, unless the
  case's mount-time client code changes the DOM: then every test requires `interactivity`, the
  server render (L6) checks a static target, and `case.json` says why in its `requires` note.
- A spec acts only through `view.user`: never `userEvent`, `page` or a locator's own actions,
  which bypass the adapter, the settling and the trace.
- A test whose component starts an interval mounts with `{ clock: true }` and moves time only
  with `view.clock.tick(ms)`, so each tick's work is a step of its own on every target, however
  loaded the machine. Any other timer runs in real time: a spec that waits for it asserts with
  `expect.poll`, a fixed wait only proves that nothing more happens (after an unmount), and no
  `expectParity`, step or action comes while such a timer that changes the DOM or emits can
  fire: it starts from an action after the first `expectParity`, and stops (or the view
  unmounts) before the next.
- A DOM read that feeds state or an emit reads what layout does not decide (`textContent`,
  attributes, `value`, `document.activeElement`), never geometry.
- No spec reorders a list, or replaces a row's item, while the focus is inside the list: keyed
  identity on reorder is not guaranteed yet.
- Specs never branch on the target (`currentTarget()`): every target runs the same checks.
- Test names and scenario names are unique in the case; scenario names are kebab-case string
  literals; a scenario with an SSR twin mounts with `mountScenario`. The summary fails a target
  whose tests check other scenarios than the reference's, test by test.
- Assertions go in the test body. A spec needs no hooks; one of its `afterEach` hooks that throws
  is recorded as L8.

## Setup files

- **`@unframework/testing/setup`**, loaded first by every browser project: the bundled Inter font
  as "UF Test Sans", the motion and caret reset, the startup assertions (DPR 1, reduced motion,
  light scheme), console capture recorded as **L13** for every test of a case (plus the
  adapter's server-side console, at mount and at each rerender), and cleanup (the unmount, then
  the real intervals back if a view had a clock). The capture starts
  when the file loads and discards nothing: a message logged while the modules evaluate or in a
  `beforeAll` hook fails the next test, marked as logged before it; the console is judged after
  the unmount's scheduled work has run; and a message after a file's last test fails the file.
  It gives every `expect.element` without a timeout the project's `expect.poll.timeout`, which
  the project must set: Vitest 5 would otherwise wait for the whole test's timeout.
  After L13 it records **L8**, the spec's own behaviour: failed with the test's own errors (its
  assertions, its hooks, Vitest's "no assertion" error, a failed unmount), but not a
  `LayerFailure`, and then fails the test with one error holding every other failed layer (L8's
  errors Vitest reports already). When L8 is quarantined, the test's own errors are removed from
  its result, which passes unless another layer failed. An `aroundEach` judges a test whose
  afterEach hooks a throwing spec hook stopped.
  Before each test it skips one whose `requires` names a capability the target lacks, recording
  why on every browser layer (above). It installs a navigation guard: a form submission or a
  link the component does not prevent is prevented by a bubbling listener on `window`, which runs
  after every framework's, and fails L8 at the next settle, rather than taking the spec file's
  frame away. After each test it fails L9 with the steps no `expectParity` compared, and resets
  the input for the next test (`ufResetInput`: the mouse to the frame's corner, the keys
  released, the focus blurred and the frame focused again).
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
- **Browser commands:** `browserCommands` (`ufArtefact`, which settles `dom.`, `aria.` and
  `trace.<name>.*`, a trace with no contents being one that must not exist; `ufAriaSnapshot`,
  `ufVisualCapture`, `ufFocus`, `ufInput` (one input of a `view.user` action: a hover, a mouse
  button's press or release, a wheel step, a key's press or release), `ufResetInput`, and
  `ufComponentEvents`, which answers from the
  compiles a project's unplugin reported to `recordCompiledModule`, for the case's only source or
  the one its `case.json` names as `main`, ADR-0057), and
  `parityBrowser({ name, commands })`, the deterministic Chromium every parity project runs
  (800×600 at DPR 1, `--font-render-hinting=none`, `--disable-partial-raster`, light scheme,
  reduced motion, a 5 s action timeout). A target's command may not take one of the testing
  API's names.
- **Layers:** `checkLayers(task, subject, { L1: () => …, L2: … })` runs checks, records each
  outcome and throws one error with every failure (`expectParity` records the same way without
  throwing). A check skips only by returning
  `{ skip: reason }` with a reason. A failure the quarantine covers is recorded as quarantined;
  a pass under an entry is recorded as a pass, because a quarantine entry is judged per
  (case, target, layer) cell, over every test that records it.
- **The parity matrix:** `ParityReporter` writes `parity-matrix.<run>.json` (version 5), with
  each project's cells and parity scenarios, and each test's, by its name without the target
  (`testKey`): the scenarios it checked, or why it was skipped by capability (`tests`); and what
  a test file recorded after its last test, the run's mode, its reference target and when it
  ended. It fails the run when a selected project collected no tests, when a test was skipped
  without recording why, when two tests of a case share a name, and, once a run has every record
  of a cell, on a stale quarantine entry. A run of some projects replaces exactly those projects' records in earlier
  matrices; a filtered run (files, test names, tags, `--changed`, `related`, watch mode) or a
  shard replaces nothing. A shard covers its projects in full only together with shards 1 to n
  of the same selection and count, with no other filter; the summary then also fails a project
  no shard collected a test of. `writeSummary` merges the partial
  matrices into `parity-matrix.json` and `parity-matrix.md` (each project's cells from its last
  run, the runs listed, every record judged by the newest run's quarantine) and appends the
  Markdown to `$GITHUB_STEP_SUMMARY`; in CI (or with `requireComplete`) a project that did not
  run, or that only filtered runs or an incomplete set of shards ran, is a problem, not a partial
  run, and `since` restricts it to the runs that ended since a time. Judged like the missing
  cells, a target whose tests check other parity scenarios than the reference's, test by test,
  is a problem (every target runs the same spec), except for a test it skipped by capability or
  for want of output. A skip on a live layer must name a capability the target lacks
  (`requires <name>: …`, the name one of `SummaryExpectations.capabilities`) or a mechanical
  cause: no output (`compile errors: no output` for the layers of a compile with errors, and
  `no output: <the expected errors>` for a browser test of such a case), the live reference, a
  component that did not render (L6), no scripted interaction. The Markdown lists each test a
  target skipped, by capability or for want of output, under its case's table.

## Normalisation (`@unframework/testing/normalize`)

`normalizeHtml(html, { target })` turns any target's HTML into one canonical text (plan §7.5).
A `class` with no token and a `style` with no declaration go, and so does a declaration with an
empty value; declarations are sorted by property unless the order of two of them decides what
renders (`@unframework/ir`'s `cssPropertiesOverlap`: the same property, a shorthand and its
longhand, a flow-relative longhand and a physical one), as frameworks disagree on these
even with themselves (ADR-0044). Class tokens keep their duplicates: a doubled class means a
broken merge. A boolean attribute's `="true"` is written empty on Qwik only, whose client writes
an attribute that is on that way.
Only the named target's framework noise is removed (Angular's hosts only from Angular's
output, Qwik's `preventdefault:`, `stoppropagation:` and `capture:` dispatch attributes and its
`q:template` elements, where its server render keeps a slot's unclaimed fallback, only from
Qwik's); without a target nothing is noise. On every target, an `<input>`'s `value` attribute
that equals its `uf:value` is left out, since it repeats the state (react-dom keeps a controlled
input's attribute in step with its value, Vue's `v-model` does not); one that differs stays
(ADR-0058). Generated ids are the compiler's `uf-id-…` ids, by
provenance (the analyzer rejects an authored id or reference with the prefix): each one, a
`uf-id-` and the characters the frameworks' ids use, is renamed `uf-id-1`, `uf-id-2`… by first
appearance wherever it appears, in every attribute value (a radio group's `name`, a `data-*`
value, an idref, a `#id` URL) and every text node, and the ARIA snapshots and payloads of the
same step take the DOM's renaming (ADR-0049). An author's suffix (`${id}-1`) makes another id,
so two ids that collide on one target still differ from the reference; authored ids are never
renamed. Whitespace collapses as Chromium lays it out, rubies
and bidi isolates included; a whitespace text that collapses away beside a ruby stays, printed
as `""`, because Chromium's ruby layout still sees it. Where a table-internal box (a bound
`display: table-cell`, say) sits in an inline box, Chromium wraps it in an anonymous inline
table, which the model does not build: that line keeps its whitespace as written, so outputs
that write it differently differ. `serializeDom` and `normalizeDom` read a
live subtree, form-control state included, and mark the element that has the focus
`uf:focused` (Playwright's default ARIA snapshot never shows it), so L7 and L9 see where the
focus is; `normalizeDom` throws on a live element, attribute
or text that the HTML parser would rebuild differently (an SVG child created in the HTML
namespace, `viewbox`, a table row without its `<tbody>`, a carriage return).

## Tests

`pnpm test` runs the unit tests in Node, the DOM tests in Chromium, and then the parity suite
(`test/parity/`): the browser API end to end against a framework-free stub target, with its
own committed artefacts and the corpus's `requireAssertions`. Its self-tests that expect a
layer to fail consume the failure with `expectLayerFailure(layer, pattern)`
(`src/browser/behaviour.ts`, not exported: a corpus spec quarantines a known failure instead);
the `stub/behaviour*` cases prove L8's pass, failure, quarantine, staleness and assertion rule,
and `test/behaviour.test.ts` reads the matrix they make. A stub with `setup` has behaviour
(listeners that change its DOM and emit its declared `emits`): `stub/interactions` proves
`view.user`, the settling (after each input too, against a stub whose render comes in a later
task, as Angular's: a stub's `settle` waits for its scheduled work), `emitted`/`events`,
payload copies, focus, the navigation guard, L9's
pass and skip and a step left at the end of a test; `stub/trace-mismatch` an L9 diff and a stale
trace; `stub/requires` a capability skip (the stub lacks a list box), which
`test/interactions.test.ts` reads in the matrix. The DOM tests also run Astro's mount
adapter, whose rerender needs the toolchain's render command (`vitest.config.ts`).
`UF_UPDATE=1 pnpm exec vitest run --config test/parity/vitest.config.ts` rewrites the artefacts.
