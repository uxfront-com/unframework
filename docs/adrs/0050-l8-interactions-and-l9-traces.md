# ADR-0050: L8 runs a person's input, and L9 compares every step it leads through

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §7.1, §7.2 (L8, L9, L10, L13), §7.3, §7.4, §7.5, §7.6, §7.7, §7.9, §8.5, §9 M2; P1, P2,
  P4; R6, R9; ADR-0012, ADR-0014, ADR-0018, ADR-0029, ADR-0031, ADR-0033, ADR-0043, ADR-0047;
  amends ADR-0019 and ADR-0043

## Context

Plan §9's exit for M2: L8 and L9 are live, with interaction traces identical across the six
interactive targets, and Astro is declared static, its skips visible in the matrix. ADR-0043 made
L8 the spec's own assertions over a static render and a rerender. M2 adds what a person does: a
click, typing, a key, focus moving, and the events a component emits in answer. Probes found what
a harness must handle for that to be one comparison on seven targets:

- **Each framework finishes an action's work at another time.** React batches inside `act` and
  renders on its scheduler outside it, and warns "not wrapped in act" when its act environment is
  set for good. Angular renders a change in a task of its own, so two inputs dispatched back to
  back (a key's press and release, the two clicks of a double click) can land before its render,
  and a watcher of what they write is called once for both.
- **Qwik runs a listener once its code has loaded.** A QRL resolves on its first run, through an
  import the browser answers in a later task, even when Qwik's preloader has fetched the bundle
  (it only fetches); once resolved, it runs inside the dispatch. Right after a first click its
  render promise is not even pending yet. Under Vitest, Qwik's test mode (`qTest`) swallows an
  error a handler throws, so L13 would see nothing.
- **A handler may continue after an `await`**, and a component may emit at mount, from a timer, or
  after a promise the user resolves later.
- **A form submission or a link a component does not prevent navigates the tester frame away**, and
  Vitest then loses every test of the spec file. A module that fails to compile puts Vite's error
  overlay over the page, and every later spec's clicks hit it.
- **Playwright's ARIA snapshot never marks the focused node**, and Chromium focuses a button on
  click.
- **Qwik 2.0.0-beta.47 replaces a keyless component whose props changed**, so M1's rerender lost the
  component's state.
- **Chromium re-rasterises only the rect a frame repainted.** A capture after a hover, a press or a
  keystroke repainted one control took the anti-aliased corner of the box beside it one level
  apart, by target and by load: an intermittent one-pixel L10 failure in full runs.
- **Astro runs no client code**, so a spec that clicks it would fail later and far from the cause;
  and a target whose capability is an error (ADR-0047) has no output for a case at all.

## Decision

- **Specs declare what they require.** `it` and `test` from `@unframework/testing` are Vitest's,
  with one more option, `requires: CapabilityName[]`. A test whose expectations depend on client
  code requires `interactivity`: one that acts, reads emits, checks a mounted state that a hook, a
  watcher or `watchEffect` changed, or checks what survives a rerender (each Astro render is a new
  instance). It also names each option capability it relies on (`event-capture`, `next-tick`, …).
  On a target whose cell for one of them is unsupported, the setup records
  `skip(requires <capability>: <the cell's reason>)` on L7, L8, L9, L10, L11 and L13, then skips
  the test. The wrapper refuses `skip`, `only`, `todo`, `fails`, `retry`, `repeats`, `concurrent`
  and `tags`: a known failure is a quarantine entry, and a flaky test is a bug. The browser gets the
  target's capability matrix from Node as plain data (`ufCapabilities`), never by importing the
  target. A `requires` that is not an array of string literals is refused: the canaries read it.
- **A case a target has no output for is skipped there, not left out.** Where a case's committed
  expected diagnostics hold an error for a target (Qwik's `conditional-event-control`), the
  browser project resolves the spec's import of the component to a stand-in that throws those
  errors if anything renders it (`harness/no-output.ts`), so the spec loads, and every test of the
  case is skipped there, whatever it requires, with `no output: <the expected errors>` on L7 to
  L13. The summary accepts it as a mechanical cause and excuses that case's tests on that target
  alone. So a case's static test requires nothing again, and Astro checks it.
- **`view.user` is a person's input, for one view**: `click`, `dblClick`, `tripleClick`, `hover`,
  `unhover`, `fill`, `type`, `clear`, `keyboard`, `tab`, `focus`, `selectOptions` and `wheel`. An
  action is the inputs a person gives apart in time, each dispatched alone through one node
  command, `ufInput` (a hover, a `page.mouse` press or release, a wheel step, a `page.keyboard`
  press or release), through the adapter's `interact`, and settled before the next:
  - `click`, `dblClick`, `tripleClick`: a move onto the element (Playwright's hover: visible,
    stable, the element under the point; a disabled element is then refused at once), then each
    press and release of the main button, the second release firing `dblclick`;
  - `type`: the focus (`locator.focus()`), each key's press and release, then every key still held
    released; `keyboard`: each key's press and release where the focus is (the frame first when
    nothing has it); `tab`: Tab's press and release, with Shift around it;
  - `wheel`: a move, then each of its steps; `hover`, `unhover`, `focus`, `selectOptions`: one
    input; `fill` and `clear`: the focus, then Playwright's fill or clear;
  - a key text names each key once: a character, `{Enter}` as Playwright names a key, `{Shift>}`
    held until `{/Shift}` (in this action or a later one), `{{` and `[[`; a character Playwright's
    US layout lacks is inserted as text with no key events, as Vitest's keyboard does. The rest of
    Vitest's syntax (`[KeyA]`, `{a>3}`), a press of a held key, a release of one not held and an
    empty text are refused before any input. A key a test leaves held is released when it ends.

  So a watcher of a field's text is called once per key typed on every target, Angular included.
  The action records one step of the view's trace once its last input settles. A spec acts only
  through `view.user`: `userEvent`, `page` and a locator's own actions skip the adapter, the
  settling and the trace. Each action takes a locator of this view only. On a target without
  `interactivity`, `view.user`, `view.emitted` and `view.events` throw, naming the missing
  `requires`. Playwright's action timeout is 5 seconds, as `expect.element`'s is (ADR-0043), so an
  action on a missing element fails L8 with `locator.hover: Timeout 5000ms exceeded`, naming the
  locator.

- **Emits are read by the source's event name.** `view.emitted("change")` gives the argument list of
  every emit of `change`, in order (`[[5]]`), and `view.events()` every emit as `[name, ...args]`.
  The names come from the module the project compiled (the unplugin's `onCompile` reports each
  compile's IR, and the browser asks `ufComponentEvents`), never from a committed `ir.json`, which
  an update run may not have written yet. A module whose components declare different events
  throws (M3 decides). Each adapter passes a listener as its framework's consumer would (ADR-0012,
  ADR-0047): React's and Solid's `onChange` prop, Vue's `onChange` beside the props, Svelte's
  `onchange` prop, Angular's `outputBinding("change", …)`, Qwik's `onChange$` QRL built with `$()`
  in an optimizer-compiled module and marked `noSerialize`, and nothing on Astro. Angular's adapter
  reads each event's shape (`MountOptions.events`) and spreads a tuple payload back into
  arguments.
- **A payload is plain data.** Each emit's arguments are copied when they arrive: strings, finite
  numbers, booleans, `null`, arrays and plain objects; `-0` becomes `0`. A function, a non-finite
  number, a `Map`, a `Set`, a DOM event or node, a class instance and an `undefined` before a given
  argument fail the test at its next settle, naming the event and the path. Trailing `undefined`
  arguments are dropped first: a listener cannot tell `emit("change", value, undefined)` from
  `emit("change", value)`, and a watcher's `previous` is `undefined` on its immediate first run.
  The `uf-id-` ids a payload carries are renamed by the step's DOM map (ADR-0049).
- **Settling.** After each input the view repeats { the adapter's `settle()`, the fonts, two frames,
  then `html()` with the number of emits } until two rounds in a row read the same, at most ten
  rounds; otherwise L9 fails "did not settle after an input of <action>". A mount settles the same
  way, and throws if the page never quiets. So a handler's work after its `await`s lands within its
  step on every target. Per target:
  - React: `IS_REACT_ACT_ENVIRONMENT` is true only inside the adapter's own `act` calls;
    `interact` is `act(input)`, and `settle()` `act(async () => {})` plus a macrotask, so an async
    handler's write after `act` renders on React's scheduler without the warning;
  - Qwik: the browser build passes every QRL a module creates, and its segment's import, through a
    registry (`packages/target-qwik/src/toolchain/loads.ts`). Before the component renders, and
    again before each input, the adapter imports every segment the component's QRLs reference and
    resolves every QRL, then those the new segments create, to a fixpoint (`preload`); a segment
    that fails to load fails the mount. So handlers run inside the dispatch, in the DOM's order,
    as an app's do once each has run. An import it did not preload is handed over as the browser
    answers it, never in request order. `interact` waits for every handler the input started,
    then a task, until no new one starts, or until those left have waited two tasks with nothing
    loading (a handler that awaits the user); `settle()` waits for every load in flight and Qwik's
    render (`_waitUntilRendered`).
- **Qwik's first runs are declared, and their controls reported.** No browser test sees a
  listener whose code has not loaded. Until it has, a Qwik listener runs after the event's
  dispatch, preloaded or not: it reads the DOM after the event's default action (a Backspace has
  emptied the field), finds the data an event carries only while it is dispatched gone
  (`clipboardData`, `dataTransfer`), its controls do nothing, and the listeners of one input run
  in the order their code arrives. The semantics page's "Outside the contract" says so, with the
  portable spellings: a control Qwik must honour on the first event is written where Qwik runs it
  at dispatch (ADR-0047), and a listener reads what the event carries (`event.key`) rather than
  the field after it. Of these, the controls are checked: while a `$` function's body runs, its
  event's `preventDefault()`, `stopPropagation()` and `stopImmediatePropagation()` log
  `[uf qwik] …` on the console if the event is still being dispatched, which fails L13. A `sync$`
  handler and a `preventdefault:` attribute run no `$` body.
- **Qwik reports its errors under test.** The Qwik toolchain's browser and SSR builds define
  `globalThis.qTest` as `false` after Qwik's plugin (`reportErrors()`), so an error a handler, a
  `sync$` or a task throws reaches the console (`QWIK ERROR`, L13) and Vitest's unhandled errors.
- **`view.clock` is the page's interval clock.** A view mounted with `{ clock: true }` (an option of
  `mount` and `mountScenario`) runs on Vitest's fake `setInterval` and `clearInterval` (the fake
  timers' `toFake`), installed before the adapter mounts the component, so a component's interval
  fires only when the spec advances the clock. `view.clock.tick(ms)`, a positive whole number of
  milliseconds, runs every interval due on the way one at a time, as real time would: it reads the
  due times from Vitest's fake clock (`setInterval.clock`), fires the first due interval alone in a
  task of its own through the adapter's `interact`, settles as after an input, and repeats, so a
  framework that renders in a task of its own (React, Angular, Qwik) renders between two
  intervals; then it moves the clock to the end and records one step, `tick <ms>ms`, holding what
  the intervals did. More than 1000 intervals in one tick fail it, and a clock it can no longer
  read throws. After an unmount a tick advances the clock the same way and settles the page, but
  records no step, so `view.emitted` shows what an interval the component left running emitted.
  Only those two functions are faked, because no framework schedules with them: `setInterval`
  appears in none of the runtime code the page loads for React 19.3.0 (scheduler 0.28.0), Vue
  3.5.43, Svelte 5.57.1, Solid 1.9.15, Angular 22.2.1 or Qwik 2.0.0-beta.47, only in doc comments,
  and none of the rxjs 7.8.2 functions Angular imports schedules. Their schedulers post
  MessageChannel tasks (React, Solid's deferred work, Qwik), queue microtasks (Vue, Svelte, Qwik),
  or race a `setTimeout` against a frame (Angular, zoneless). Astro runs no client code, and a tick
  throws there as an action does. `Date`, `performance`, `setTimeout` and the frames stay real, and
  Vitest's own waits keep the timers it saved at startup. Vite's client pings its server on an
  interval it started before the clock; the fake timers' `shouldClearNativeTimers` hands a
  `clearInterval` of it to the native one. The clock is the page's, so one view of a test may have
  it, and a second throws before it mounts. The setup gives the page its real intervals back when
  the test ends, after the unmount, so a teardown clears its interval on the clock that set it.
- **Between tests** the setup moves the mouse to the frame's corner, off every root, releases the
  keys, blurs the active element and focuses the frame again (`ufResetInput`). A navigation guard,
  a bubbling `window` listener for `submit` and for `click` on `a[href]` that runs after every
  framework's own, prevents what the component did not and fails L8, naming it ("a form submission
  was not prevented"). The browser projects send Vite's compile errors to no page
  (`noErrorBroadcast()`, which drops the `error` payloads Vite sends to the pages; Vitest's forced
  `server.hmr: false` made `server.hmr.overlay: false` ineffective), so a module that fails to
  compile fails its own spec's import only, and Vite still logs it.
- **Focus is in the DOM.** The normalised DOM marks `document.activeElement`, inside the root and
  never the body, with a `uf:focused` pseudo-attribute, as it marks form state with `uf:value`. It
  shows in `dom.<name>.html` and in every step, so a target that loses or misplaces focus fails L7
  and L9.
- **L9 compares traces.** Each `view.user` action, each `rerender` and each `view.clock.tick`
  appends a step to the view's trace once it settles: `{ action, dom, aria, events }`. `action` is
  the same on every target: the action, the locator without the view's root
  (`getByRole('button', { name: '+3' })`, in Playwright's spelling) and its arguments as JSON
  (`rerender {"label":"New"}`), or the time a tick advanced (`tick 1250ms`). `dom` is the normalised
  DOM and `aria` the ARIA snapshot, a line each, its generated ids renamed by the DOM's map.
  `events` holds the emits since the step before, grouped by name, names sorted, each name's
  argument lists in order: the order of different effects one run triggers is not part of the
  contract (ADR-0048). The first step's events also hold what the component emitted while it
  mounted, which every target emits alike. `expectParity(name)` records L9 between L7 and L10: the
  steps since the mount, or since the previous `expectParity`, go to
  `__expected__/trace.<name>.json`, which the reference writes and every other target must equal.
  Then they are cleared. A scenario with no step has no file, and L9 records
  `skip(no scripted interaction)`. A step no `expectParity` compared fails L9 when the test ends.
  The file is pretty JSON, so a diff names the line (`state/counter`'s
  `trace.after-increment.json`):

  ```text
  {
    "version": 1,
    "steps": [
      {
        "action": "click getByRole('button', { name: '+3' })",
        "dom": [
          "<div class=\"counter\">",
          "  <output>",
          "    \"5\"",
          "  </output>",
          "  <button type=\"button\" uf:focused=\"\">",
          "    \"+3\"",
          "  </button>",
          "</div>"
        ],
        "aria": [
          "- status: \"5\"",
          "- button \"+3\""
        ],
        "events": {
          "change": [
            [
              5
            ]
          ]
        }
      }
    ]
  }
  ```

- **The spec rules** (`tests/integration/README.md`, ADR-0043's, extended), the ones a spec's text
  shows checked by the compile project (`specProblems`):
  - each test calls `expectParity`, then asserts a positive fact; emits are checked with
    `emitted` or `events`;
  - a test asserts after `expectParity`: between a step (a `view.user` action, a `rerender` or a
    `clock.tick` of a mounted view) and the `expectParity` that compares it, it asserts nothing
    (`expect(`, `expect.element(`, `expect.poll(`), and it ends with no step uncompared. Steps in a
    row may share one `expectParity`, but a step that acts on what an earlier step's handler alone
    renders, or follows a submission or a link a handler must prevent, comes after an
    `expectParity` of the earlier step, so a missing handler fails L9 before a later action or
    assertion can abort the test. A tick after `view.unmount()` is no step. A spec that acts or
    rerenders outside a test body is refused: the harness reads each test's steps from its body;
  - every case has a test whose first `expectParity` comes before any action and that requires
    nothing, so Astro checks something and the canaries reach every target; it asserts first
    through a locator (`expect.element`, `expect.poll`), so a render of nothing fails it as a
    query that finds nothing. Where the case's mount-time client code changes the DOM, every test
    requires `interactivity`, L6 checks Astro, and `case.json` says why in a `requires` note,
    present exactly then;
  - test names and scenario names are unique in a case;
  - no spec reorders a list, or replaces a row's item, while focus is inside it (ADR-0046);
  - a DOM read that feeds state or an emit reads what layout does not decide (`textContent`,
    `childElementCount`, `value`, `activeElement`), never geometry;
  - **timers**: a test whose component starts an interval mounts with `{ clock: true }` and moves
    time only with `view.clock.tick`, so what each tick did is a step of its own on every target,
    however loaded the machine. A test whose component makes a request replaces `fetch` with a
    stub that answers on the view's clock (`effects/persistence-and-fetch`): no real request
    leaves the page. Any other timer runs in real time: a spec that waits for it asserts with
    `expect.poll`, and a fixed wait only proves that nothing more happens after an unmount.
    Nothing a capture or a step records may depend on such a timer: it starts from a `view.user`
    action after the first `expectParity`; one that changes the DOM stops, or the view unmounts,
    before the next capture; and no step is recorded once one that emits has fired.
- **L1 refuses what a feature case must not expect.** `expectationProblems` fails a case whose
  expected diagnostics hold a UF9xxx code for a target, in any case, and, in a case with a spec, any
  error for a target but exactly the diagnostic its capability matrix declares for a capability it
  lacks (code, severity `error`, and the message
  `The <target> target does not support <capability>: <reason>`). It runs once the diagnostics equal
  the expectation, so it holds in update mode too. The fix check leaves out, on both sides, every
  diagnostic a capability cell reports, whatever its severity.
- **The coverage gate reads every kind family of the IR.** Every kind of the seven coverage records
  of `@unframework/ir` (render nodes, attributes, bindings, setup items, handlers, watch sources
  and code references), every capability a target supports and every catalogued diagnostic code
  needs a case (`harness/coverage.ts`). `EXEMPT_KINDS` excuses a kind by family, with a reason; an
  exemption the corpus covers, or one that names no kind of its family, fails the gate.
- **Capability skips are in the matrix.** Records carry the test's key, its full name without the
  ` [<target>]` suffix. The matrix (version 5) adds
  `tests: case → target → test → { scenarios, skipped? }`, and the summary compares scenarios test
  by test, excusing a follower's test skipped by capability and that test alone, and lists every
  test a target skipped by capability, or for want of output, under its case. A skip on a live
  layer names a capability the target lacks (`requires interactivity: …`), a quarantine entry, or
  a mechanical cause: no output, the live reference, a component that did not render, no scripted
  interaction. The reporter fails a run where two tests of a case share a name.
- **The canaries.** `L8-render-nothing` drops the setup and keeps the props, the events and their
  binding, so the outputs still declare what a mount listens to; its evidence also matches an
  action's timeout. `L9-unwired-handler` removes every element listener on every target but the
  reference, on the cases whose tests act and whose IR listens, on targets with `interactivity`:
  each action's step differs from the trace. `L9-rerender-text` appends the text canaries' marker
  on the cases whose tests rerender, which `L9-unwired-handler` cannot reach.
  `L13-qwik-handler-throws` gives every Qwik component a document listener (`useOnDocument`) that
  throws on any `view.user` input and changes nothing it renders, on the cases whose tests act on
  Qwik; a canary may name its targets, and the run then corrupts and judges those alone. The
  verdict reads each kind of project's own cells (the server's console proves nothing of the
  page's), and judges a browser project only on the cases a test of which runs there, and a canary
  of the tests that act or rerender only where such a test runs (`interacts(target)`,
  `rerenders(target)`, from each test's own `requires`); a cell a target skipped by capability
  ran nothing to corrupt and is excused, as a quarantined one is; a target on which the canary
  applies to no case (Astro, for the cases whose tests act) is not judged, and the run says so.
  Angular's script injection prepends into an existing constructor (M2's effects and hooks write
  one).
- **The targets page is checked against the cells.** `tests/repo` renders every target's
  capability cells into the table of `apps/web/content/docs/3.reference/1.targets.md` (support and
  helper), a row for every capability in `CAPABILITY_NAMES`' order, and requires a note under the
  table for every cell that is not native, as it checks the diagnostics page against the catalogue.
- **CI** runs the canary matrix as a YAML block sequence, with at most one canary that runs the
  browser projects in each job (`L9-unwired-handler`, `L9-rerender-text`, `L13-console-warn`,
  `L13-qwik-handler-throws` among them). `pnpm test:baselines` updates through `browser:vue` only,
  and fails when a `dom.`, `aria.`, `trace.` or `ssr.` expectation in the container reads otherwise
  than in the repository: those must not depend on the platform.
- **Amendment to ADR-0019.** The parity projects launch Chromium with `--disable-partial-raster`
  beside `--font-render-hinting=none` (`parityBrowser`, a module constant with the reason): every
  repainted tile is rasterised whole, so a pixel depends on the DOM and the fixed tile grid, never
  on what was repainted before the capture. Nothing in the page changes, on any target, in either
  pixel mode, and Vue's captures and the committed Linux baselines are unchanged by it.
- **Amendments to ADR-0043.**
  - `LIVE_LAYERS` gains L9, and a layer that is not live records `skip(not live in M2)`.
    `expectParity` records L7, L9, L10 and L11.
  - Rerenders: Svelte's adapter gives each prop a `$state.raw` box of its own, so a prop holds the
    caller's own value (a `structuredClone` of its item works), deletes the keys the new props lack
    and assigns only the keys whose value changed, as a parent does (assigning a callback no code
    had read yet made Svelte hand a teardown the value from before the flush); Solid's passes the
    props as `mergeProps` over a plain record, never a store's proxies; Qwik's host renders the
    component under a key, so a rerender keeps the instance and its state, and a component mounted
    with no props gets its first props on a new instance; React renders inside `act` with the act
    environment set for that call only.
  - M1's rule that no feature case uses an unsupported capability is lifted for behavioural
    capabilities (ADR-0047): Astro's interactive tests are skipped by capability and listed, and
    the coverage exemptions of `interactivity` and UF4001 are gone.
  - `L8-render-nothing` keeps the events and their binding, as above.

From `state/counter`:

```ts
it("increments by the step and emits the new value", { requires: ["interactivity"] }, async () => {
  const view = await mountScenario(Counter, "initial");
  await view.user.click(view.getByRole("button", { name: "+3" }));
  await view.expectParity("after-increment");
  await expect.element(view.getByRole("status")).toHaveTextContent("5");
  expect(view.emitted("change")).toEqual([[5]]);
});
```

## Consequences

**Positive:**

- Every action is checked three ways on six targets: the spec's own assertions (L8), the DOM, the
  ARIA tree, focus and the events after each step (L9), and pixels and axe at each capture (L10,
  L11).
- A target that runs a handler late, drops an emit, loses focus, coalesces a person's two inputs
  or leaves a default unprevented fails a named layer, with a diff that names the step and the
  line; a Qwik handler that throws or prevents too late fails L13.
- A capture is a function of the DOM, whatever was repainted before it, so L10 compares the same
  pixels in every run.
- Astro's static render is still compared, and what it cannot run, or a target has no output for,
  is listed in the matrix with its reason.

**Negative:**

- The harness reaches into frameworks: React's act environment, Qwik's QRL factory, its segment
  imports, its dispatch, its `qTest` and its `_waitUntilRendered`, Vitest's fake clock, and
  Svelte's flush. A framework release can break a settle, which the adapters' own tests would
  show.
- Settling costs at least two frames a round and up to ten rounds an input, about 70 ms an input:
  a typed word settles once per key. A slow page fails L9 rather than waiting longer.
- The Qwik project checks listeners that have run once: a first run's order and its late reads of
  the DOM are declared, not tested, and only its controls are reported.
- `view.clock` fakes intervals only. A case whose output depends on a `setTimeout`, on `Date` or on
  a frame still follows the real-time rule. A framework release that schedules with `setInterval`
  would wait on the spec's ticks under a clock, and fail a mount or a step that never settles,
  loudly: the runtimes must be read again when a target's framework is upgraded.
- Payloads exclude what JSON cannot hold, so a component that emits a `Date` or a `Map` cannot be a
  corpus case as written.

**Open:**

- The browser canaries' times over M2's corpus (up to six minutes for `L8-render-nothing`), and
  whether their CI jobs and `integration-browser` need a target dimension or shards to stay within
  ten minutes (§7.9).
- M3: a mount of several components per case, and consumer listeners on child components.

## Alternatives considered

- **Assert on each target's own events with `userEvent` and `page` in specs.** A spec would skip
  the adapter's `interact`, the settling and the trace, and compare nothing across targets.
- **One Playwright call per action** (the first build). Its inputs land back to back, so a target
  that renders in a task of its own coalesced a key's press and release, or a double click, and a
  watcher's calls depended on the machine.
- **Split only the key descriptors through Vitest's `userEvent.keyboard`.** A key's press and
  release, a click's and a double click stay back to back; and its `{…}` lookup ignores case, so
  `{A>}` presses `a`.
- **Playwright's `trial: true` click as the check before the move.** It moves, presses and
  releases the mouse with a blocking listener on the window, and a window capture listener the
  page added (Qwik's capture emulation) sees the trial's `click`.
- **Read the declared events from the committed `ir.json`.** An update run writes it after the
  browser projects start, so a new event would be unknown to the run that adds it.
- **Hand Qwik's segments over in the order they were asked for** (the first build), as a resumed
  page's loader was thought to queue them. It made the browser tests run one action's handlers in
  request order whatever the network did, and Qwik's preloader does not order imports: it only
  fetches.
- **Import Qwik's segments without resolving the QRLs.** A listener's first run still raced the
  others, so the harness checked the declared first-run order instead of the contract.
- **Leave a case a target has no output for out of that target's browser project.** The summary
  would find the reference's scenarios missing; a stand-in lets each test be skipped, named.
- **Record events in the order they came, across names.** Vue orders different effects by trigger,
  Svelte and React by declaration; the contract does not promise it, so the trace must not depend
  on it.
- **A real interval under the timer rule**, the first rule: a capture came right after the action
  that started the interval, and before its first tick. It assumed that the action settles within
  the interval (500 ms in `lifecycle/unmount-timers`): on a loaded machine a refresh can land inside
  the click's step on one target and after it on another, and L9 then compares the machine's speed.
- **Advance the clock in one call** (`vi.advanceTimersByTimeAsync`, the first `view.clock`). The
  due intervals fired without a render between them on React and Qwik, so a watcher was called
  once for three ticks.
- **Fake every timer**, Vitest's default. `setTimeout`, the frames, `Date` and `performance` are
  what the frameworks schedule and measure with (Angular's zoneless scheduler races a `setTimeout`
  against a frame; React's and Solid's schedulers read `performance.now()`), so their work would
  wait on the spec's ticks.
- **Repaint the whole root before each capture**, or a pixel tolerance. The first mutates the page
  during the capture and leaves the root's edge to the history; a tolerance or a retry is
  forbidden.
- **Refuse every `undefined` in a payload**, the first rule. An immediate watcher's first `previous`
  is `undefined`, and a trailing one is the same as an absent one to every listener.
- **Mark focus in the ARIA snapshot.** Playwright's default snapshot never shows `[active]`.
- **Skip Astro's interactive tests silently, or fail them.** A silent skip hides the static cell
  from the matrix (P4); a failure blames Astro for a declared difference.

## Evidence

- `packages/testing/test/parity/cases/stub/interactions/interactions.parity.spec.ts`: "renders the
  initial count, with no trace to compare", "counts clicks and emits each count, as the trace
  records", "marks the focus, and copies an object payload", "starts each test with nothing focused,
  and tabs into the view", "settles a handler's work after its awaits within the step", "settles
  after each input of an action, so a watcher a later render runs sees each one" (a stub whose
  render comes 30 ms after a write; it fails with the settle between inputs removed), "records a
  rerender as a step", "acts only on locators under the view's root, presses only keys it can, and
  reads only declared events", "refuses a payload no trace can hold, naming the event and where",
  "prevents a form submission the component leaves alone, and fails at the next settle" and "lets a
  submission the component prevents through".
  `packages/testing/test/parity/cases/stub/trace-mismatch/trace-mismatch.parity.spec.ts`: "fails L9
  with the diff of a step that differs from the trace" and "fails L9 on a trace committed for a
  scenario that no step led to".
  `packages/testing/test/parity/cases/stub/clock/clock.parity.spec.ts`: "runs the intervals due one
  at a time, settling after each, as real time would" (it fails with one advance), "runs an interval
  only when the clock ticks, inside the tick's step", "shows what an interval left running emits
  after the unmount, with no step", "gives the page its real intervals back when the test ends" and
  "refuses a tick without a clock, a tick that is not whole milliseconds, and a second clock".
  `packages/testing/test/parity/cases/stub/requires/requires.parity.spec.ts`: "runs a test whose
  capabilities its target supports" and "skips a test that requires a list box, which the stub
  lacks". `packages/testing/test/parity/cases/stub/behaviour/behaviour.parity.spec.ts` "fails L8
  with an action on an element that is not there". `packages/testing/test/interactions.test.ts`
  "records each test's scenarios and capability skip, and L9, in the parity matrix" reads the matrix
  the stubs make.
- `packages/testing/test/keys.test.ts`: "presses and releases each character, and each key in
  braces", "holds a key until its release, and checks both against the keys held", "types a brace
  or a bracket written twice, and a character outside the layout as text" and "refuses an empty
  text and the syntax it does not take". `packages/testing/test/commands.test.ts`: "moves onto an
  element as Playwright's hover does, then presses where it is", "refuses a disabled element before
  a click, as Playwright's click would", "presses a key, and inserts a character the layout lacks
  as text with no key", "registers the testing API's commands and a target's own", "settles a
  trace, and a trace that must not exist", "focuses the locator's selector in the tester iframe",
  "answers with the events of the project's own compile of the case's module", "refuses a module
  whose components declare different events" and "launches Chromium without font hinting and with
  whole-tile raster, for the captures".
- `packages/testing/test/trace.test.ts`: "records each step with the events since the step before,
  and gives them up once", "renames the generated ids a payload carries as the step's DOM does",
  "renames the generated ids the ARIA tree carries as the step's DOM does", "fails L9 with the steps
  a test left uncompared, once" and "writes versioned, pretty JSON with one trailing line break".
  `packages/testing/test/events.test.ts`: "copies plain data, so a later change to the original
  never reaches the log", "drops trailing undefined arguments, which a listener cannot tell from
  absent ones", "refuses what no trace can hold, naming the event and where the value is" and
  "groups by name, names sorted, each name's emits in the order they came".
  `packages/testing/test/capabilities.test.ts`: "names the first capability the target lacks, with
  its reason", "refuses an interaction where nothing runs, saying to declare requires" and "skips
  every test of a case the target has no output for, with the errors it expects".
  `packages/testing/test/dom.browser.test.ts`: "marks the element that has the focus, and moves the
  mark with it" and "marks a focused SVG element too, and never the body".
- `packages/testing/test/matrix.test.ts` "keeps each named test's sorted scenarios and capability
  skip, and nothing else"; `packages/testing/test/summary.test.ts` "compares test by test: a
  scenario checked by another test of the target counts not", "excuses a test a target skipped by
  capability, and only that test", "excuses every test of a case a target has no output for, on
  that target alone", "lists the tests a target skipped by capability under the case's table",
  "accepts a capability the target lacks, and every mechanical cause" and "fails a skip that names
  no capability or mechanical cause, or an unknown capability";
  `packages/testing/test/reporter.test.ts` "fails the run when two tests of a case share a name".
- The adapters: `packages/target-react/test/events.browser.test.ts` "passes the test's listeners as
  event props, and keeps them across a rerender" and "declares the act environment only inside its
  own act calls"; `packages/target-vue/test/events.browser.test.ts` "passes the test's listeners
  beside the props, and keeps them across a rerender";
  `packages/target-svelte/test/events.browser.test.ts` "passes the test's listeners as lower-case
  callback props, kept across a rerender"; `packages/target-svelte/test/props.browser.test.ts`
  "hands the caller's own objects, which structuredClone copies" and "replaces the values that
  changed, and deletes the keys a rerender lacks";
  `packages/target-solid/test/events.browser.test.ts` "passes the test's listeners as event props,
  and keeps them across a rerender"; `packages/target-angular/test/events.test.ts` "binds each
  listener to its event's output and gives the payload back by its shape" and "refuses a listener
  whose event's shape it was not told, and Angular one it has no output for";
  `packages/target-qwik/test/events.browser.test.ts` "passes the test's listeners as QRL props, and
  waits for the handlers an action loads".
- Qwik's lazy code and errors: `packages/target-qwik/test/loads.test.ts` "passes the import of
  every QRL through the registry, in development and in a build", "wraps the QRL factory a module
  imports from Qwik's core, so each QRL it creates registers", "preloads every segment the QRLs
  reference, and those their segments' QRLs reference", "resolves every QRL the page created, and
  those the segments it loads create", "hands a QRL its segment's functions marked as `$` bodies,
  which return what they return", "rejects the preload with a segment that fails to load", "hands
  each load over as it arrives, not in the order it was asked for" (it fails with the old chaining)
  and "turn `qTest` off in %s projects"; `packages/target-qwik/test/loads.browser.test.ts` "loads
  every handler before a test acts, and runs one action's handlers in the DOM's order" (without the
  resolution, a first click logged `change, click`) and "reports a control a `$` handler's body
  calls during the dispatch, and no control Qwik runs at dispatch";
  `packages/target-qwik/test/behaviour.browser.test.ts` "runs an unawaited async call's synchronous
  part before the caller goes on".
- Rerenders: `packages/target-qwik/test/rerender-state.browser.test.ts` "keeps the instance and its
  state across a rerender: %s" and "renders a component's first props on a new instance, and leaks
  them nowhere"; `packages/target-svelte/test/behaviour.browser.test.ts` "calls a callback prop from
  a teardown that runs on the first rerender", red before the adapter's change and green after.
  `packages/unplugin/test/vite.test.ts` "receives every compile, and leaves a module it accepts
  alone".
- The harness: `tests/integration/harness/cases.unit.test.ts` "reads each test's name, its
  requires, whether it checks before it acts, and its steps", "accept a spec that checks before it
  acts, and acts through view.user", "refuse two tests of one name", "refuse actions that bypass
  view.user", "need a test to assert after the expectParity that compares its steps", "let a test
  assert after an unmount's clock tick, which is no step, and read no comments", "refuse steps
  outside a test, where the harness cannot tell which test takes them", "refuse a requires the
  harness cannot read", "need a test that requires nothing to assert first through a locator",
  "need a test that checks a scenario before it acts", "need the requires note exactly when every
  test requires a capability" and "are the diagnostics, each SSR scenario's HTML, and each parity
  scenario's DOM, ARIA, trace, geometry and pixels"; `tests/integration/harness/compile.test.ts`
  "holds specs that follow the spec rules the harness can read" and "covers every IR kind,
  capability cell and diagnostic code with a case".
- L1 and coverage: `tests/integration/harness/compile-checks.unit.test.ts` "fails an internal error
  on its own target, in any case", "passes a feature case's error that its target declares for a
  capability it lacks", "fails any other error in a case with a spec, and lets a diagnostics case
  expect it" and "passes a fix that brings a capability cell's warning, whatever its severity";
  `tests/integration/harness/coverage.unit.test.ts` "fails on a missing kind of each family, the
  four of setup code included", "excuses an exempt kind, and fails a stale exemption or one that
  names no kind" and "reads the setup items, handlers, watch sources and code references of a
  compile".
- No output and the overlay: `tests/integration/harness/no-output.unit.test.ts` "lists the cases
  with a spec whose expected diagnostics hold an error for the target", "leaves out a case whose
  expectations are missing, which the compile project writes first", "resolves a spec's import of
  such a component to a stand-in that loads, and nothing else" and "serves a component that throws
  the reason if anything renders it"; `tests/integration/harness/projects.unit.test.ts` "serve
  stand-ins for the cases their target has no output for, before the unplugin" and "send no compile
  error to the pages, whose overlay would cover every later spec". Before `noErrorBroadcast()`, a
  case Qwik could not compile made every later `browser:qwik` click time out on
  `<vite-error-overlay> intercepts pointer events`, a probe's finding.
- The canaries: `tests/integration/harness/canaries.unit.test.ts` "L8-render-nothing drops the setup
  but keeps the events and their binding", "L9-unwired-handler removes every element listener, in
  branches and lists too", "L9's canaries apply to the cases whose tests act or rerender, on the
  targets they run on", "read which tests of a case run on each target, and which of those act or
  rerender", "L13-qwik-handler-throws gives Qwik's component a throwing document listener, and
  changes no other target", "prove every project of each live layer", "injects into a component body
  whose parameters hold parentheses of their own" (Angular's existing constructor), "run in CI as a
  matrix: every canary once, and at most one browser canary per job" and "$id corrupts every case
  with output on every target it corrupts, keeping the IR valid";
  `tests/integration/harness/canary-verdict.unit.test.ts` "requires each kind of project's own
  evidence, in its own cells", "excuses a cell its target skipped by capability, as it does a
  quarantined one", "judges L9-unwired-handler on the followers' cases that act and listen",
  "judges L9-unwired-handler on the six followers, and says Astro is not judged", "judges
  L13-qwik-handler-throws on Qwik's cases that act, and no other target", "judges L9-rerender-text
  where a rerendering test ran, beside a static test on Astro", "judges L13 on a case.json requires
  case by its server render alone on Astro", "judges L8 on every target, and on Astro only the cases
  whose tests run there" and "is required of a spec whose every test its target skips: the import
  fails first".
- `tests/repo/test/targets-page.test.ts`: "has a row for every capability, in the matrix's order,
  and a column for every target", "writes each target's cell as the target declares it" and "has a
  note under the table for every cell that is not native". It found Svelte's `event-once` cell
  still `native` on the page after the target made it `emulated`.
- After M2's first build, `pnpm --filter @unframework/integration test:canaries` caught every
  canary of L1 to L6 on every case and target they corrupt (`L1-diagnostic-added` 2.1 s,
  `L2-nondeterministic` 2.9 s, `L4-type-error` 5.5 s, `L6-golden-guard` 34.8 s, among 13), locally
  on an Apple M4 Max. After the input settling of the last review, the browser canaries were each
  caught on every case and target they corrupt, run as CI runs them on seven targets:
  `L9-unwired-handler` in 138.5 s, `L13-qwik-handler-throws` in 84.4 s, `L8-render-nothing` in
  342.3 s, `L9-rerender-text` in 138.7 s and `L13-console-warn` in 140.3 s.
- Probes, with Vitest 5.0.3, @vitest/browser-playwright 5.0.3 and Playwright 1.63.0 (Chromium): with
  the act environment set for good, React 19.3.0 warns "not wrapped in act" for an async handler's
  write; in Qwik 2.0.0-beta.47 a settle right after a click resolved before the handler's segment
  loaded (`$renderPromise$` still `null`); Vitest builds no selector for an element carrying Qwik's
  `:` attribute, which is one more reason `view.user` takes locators only. A scratch case whose
  watcher emits each value of a typed field gave Angular `[["al"]]` for Vue's `[["a"], ["al"]]` in
  5 runs of 5 with one call per action, and passed on all seven in three runs with an input at a
  time. Qwik's Vite plugin defines `globalThis.qTest` as `NODE_ENV === "test"` whatever the
  configuration says (`dist/optimizer.mjs`), and a scratch handler that threw logged nothing on
  Qwik before `reportErrors()`.
- The raster fix: `packages/testing/test/parity/cases/stub/raster/raster.parity.spec.ts` "captures
  the same DOM in the same pixels, whatever Chromium repainted last" (eight rows of two rounded
  boxes; it fails without the switch). Before the switch, 6 runs of 6 of every browser project
  failed L10 by one pixel at a clicked button's neighbour (`events/function-handlers`
  `keys-recorded` on all five followers, `semantics/watch-timing` `searched-and-skipped`); after
  it, 12 runs of 12 passed, and 6 of 6 more under extra CPU load. Vue's 198 live captures were
  byte-identical with and without it, and `pnpm test:baselines:check` passed every M1 case against
  the committed Linux baselines.
- `lifecycle/unmount-timers` on its interval's clock, in check mode on every target: 15 runs in a
  row green, then 5 more under fourteen busy CPU loops on fourteen cores (load average 26 to 51),
  where "stops refreshing once unmounted" took up to 1.1 s against 0.7 s and its traces stayed the
  same. The runtimes read for the clock: React 19.3.0 with scheduler 0.28.0, Vue 3.5.43, Svelte
  5.57.1, Solid 1.9.15, Angular 22.2.1 with rxjs 7.8.2, Qwik 2.0.0-beta.47, Vite 8.3.1's client and
  Vitest 5.0.3's browser client.
- The corpus: 178 cases on seven targets, 67 of them M2's feature cases, every interactive test
  skipped on Astro by capability, and every test of a case Qwik has no output for skipped there for
  want of output, each listed under its case in the parity matrix's summary; every browser project
  on the whole corpus, after the targets' last structural changes: 763 files, 2244 tests passed,
  199 skipped, the summary green. `effects/watch-effect` asserts the interleaving of its runs and
  cleanups through `view.events()`, a same-value write that runs nothing, and the last cleanup at
  unmount; the traces of `semantics/reactive-props` (M1) hold its rerender steps.
