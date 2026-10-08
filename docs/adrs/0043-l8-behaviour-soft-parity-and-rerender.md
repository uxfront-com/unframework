# ADR-0043: L8 records the spec's own assertions, parity is soft, and every adapter can rerender

- **Status:** Accepted, amended by ADR-0050, ADR-0052
- **Date:** 2026-10-05
- **Plan:** §4.5 (Reactive props), §7.2 (L8), §7.3, §7.4, §7.7, §7.9, §9 M1; P1, P2, P4; R9;
  ADR-0018, ADR-0024, ADR-0029, ADR-0033, ADR-0034

## Context

L8 goes live in M1: "the spec's own assertions: text, emitted events, model updates, focus,
rerendering with new props" (§7.2), limited in M1 to static behaviour and rerendering. In M0,
`expectParity` throws on the first failed layer, so a spec's own assertions after it never run,
and nothing records L8. Three facts shape the change:

- **Vitest 5.0.3 fails a test before `afterEach` runs.** The test function's error is already in
  `task.result` when the setup's `afterEach` sees it. Recording a layer there cannot undo it, so a
  quarantined L8 cell would still turn the browser job red.
- **A spec that asserts nothing, or only absences, passes against an empty render.** The L8 canary
  has to make every spec fail.
- **No adapter can rerender.** `MountedComponent` has `settle` and `unmount` only, and each
  framework replaces props its own way: Angular cannot unset an input, Qwik's props are serialised,
  Astro is static.

## Decision

- **Parity is soft.** `expectParity` records its scenario and L7, L10 and L11, and resolves when a
  layer fails; the spec's assertions after it always run. It rejects only on misuse (a scenario
  name that is not kebab-case, a tolerance without a reason, a call outside a test), which then
  counts as the test's own error.
- **The setup's hooks record L8.** After each test, the setup file unmounts what the test mounted,
  newest first, lets the teardown's scheduled work run (a task, then a frame), records L13 from the
  console, and then judges L8 (`judgeTest`): it fails with the test's own errors, those that are
  not the harness's `LayerFailure`s, and a failed unmount. It then throws one `LayerFailure` that
  lists every other failed layer; Vitest already reports L8's own errors. When L8 settles as
  quarantined, it removes the test's own errors from `task.result.errors` and, if no other layer
  failed, sets `task.result.state` to `"pass"`. A stale L8 entry fails like any other (§7.7).
- **An `aroundEach` hook judges a test the `afterEach` could not.** A spec's own `afterEach` that
  throws stops Vitest from running the after-hooks registered before it, the setup's among them;
  Vitest 5's `aroundEach` wraps every test, and judges one the `afterEach` did not reach, once.
- **A test-only escape**, `expectLayerFailure(layer, pattern)`, lets the testing package's
  self-tests consume a failure they expect. It is not exported: a corpus spec never expects a layer
  to fail, and a known failure is a quarantine entry. The stub cases `behaviour`,
  `behaviour-known` and `behaviour-stale` prove L8's pass, its failures (an assertion, no assertion,
  a failed unmount, a spec hook that throws), its quarantine and its staleness.
- **Spec rules.** Browser projects set `expect.requireAssertions: true`, with a 5-second poll
  timeout, which the testing setup also gives every `expect.element` call that names no timeout of
  its own (`boundElementTimeout`), so an assertion on an element that never appears fails in 5
  seconds; a project without a poll timeout fails to start. The failure mostly names its locator,
  but one `timeout` option sets both the poll's timer and `findElement`'s deadline, and no public
  option sets them apart, so whichever notices first words it: sometimes Vitest's bare
  "expect.poll() function didn't resolve in time." (53 of the 497 failures in the
  `L8-render-nothing` canary run with the bound in place; Evidence gives both runs). The stack names
  the spec's assertion either way. Every test calls `expectParity` first, then asserts at least one
  positive fact about the rendered output through the view's queries (a text or a role is there).
  Specs never branch on the target, scenario names are unique string literals in the case (the
  harness reads them), and specs use no hooks. The harness checks the literals; the rest is
  convention, written down in `tests/integration/README.md`, which every corpus spec follows.
- **Scenarios come from `case.json`.** `mountScenario(Component, name)` mounts with a copy of
  `case.json`'s `ssr[name].props`, and names the declared scenarios when `name` is not one, so an
  SSR scenario and its browser twin cannot drift. A browser-only scenario (an explicit `undefined`,
  which JSON cannot carry, or a rerender) says so in a comment and mounts with `mount`. The parity
  matrix (version 4) records each (case, target)'s scenarios and the reference target, and the
  summary fails a target whose scenarios differ from Vue's, in a complete run or in CI.
- **Typed mounting.** `mount<P>(component: (props: P) => unknown, options?)` takes
  `ComponentMountOptions<NoInfer<P>>`, `mountScenario<P>` is typed alike, and
  `View<P>.rerender(props: P)`, so a spec cannot pass props the component's type rejects, and the
  props never widen the type; the corpus's type check runs over every spec. An overload for what is
  not a function serves the testing package's stubs.
- **`rerender(props)` replaces the props whole** on `MountedComponent` and `View`, on all seven
  adapters: a key absent from the new props is removed, never set to `undefined`, except on
  Angular, which cannot unset an input. `MountedComponent` is a `RenderReport`, and `rerender`
  returns one: what the render logged where the page cannot see it (Astro's server render), which
  L13 judges. A rerender after unmount throws.

  | Target  | How                                                                                                        |
  | ------- | ---------------------------------------------------------------------------------------------------------- |
  | React   | `root.render` inside `act`                                                                                 |
  | Vue     | a `shallowReactive` props object read by the root's render function: absent keys deleted, then `nextTick`  |
  | Svelte  | a `$state` object (`props.svelte.ts`): delete the absent keys, assign the new, then `flushSync`            |
  | Solid   | a store, set in a `batch` with `produce`, without reconciling by `id`, so the harness invents no identity  |
  | Angular | `setInput` per key, `setInput(name, undefined)` for removed keys (ADR-0034's transform), then `whenStable` |
  | Qwik    | `Host`, an optimizer-compiled `component$` whose signal holds the props, then `_waitUntilRendered`         |
  | Astro   | a new server render through `ufAstroRender`, its HTML replacing the old, its console returned              |

  Qwik's server render, mount and rerender build the component with `_jsxSorted` and its props
  sorted by key (`packages/target-qwik/src/toolchain/element.ts`), as the optimizer compiles a
  parent's written attributes, so a `null` prop reaches the component as `null`: Qwik's public
  `jsx()`, like a spread, goes through `_jsxSplit`, which deletes null-valued props (ADR-0034).
  Before this, the corpus never delivered `null` to Qwik.

  On Angular, a prop that is not an input logs NG0303, at mount and at rerender, which fails L13.

- **No feature case uses an unsupported capability in M1.** A construct one target cannot render
  is rejected for every target by the analyzer instead (ADR-0037). The two unsupported cells, Vue's
  `listbox` and Astro's `interactivity`, are exempt from the coverage gate with their reasons, so
  no browser project loads a spec whose module failed to compile for its target.
- **Live layers.** `LIVE_LAYERS` gains L5 and L8, and the browser projects record L8. A case
  without output (a diagnostics case) records both as `skip(compile errors: no output)`. Layers
  that are not live record `skip(not live in M1)`.
- **Canaries.** M1 adds four to M0's fifteen, each caught by its own layer on every case and
  target it corrupts:
  - `L8-render-nothing` replaces every component's render with an empty `<div>`, keeping only the
    `prop` bindings so the IR stays valid, and must fail L8 on every spec and target. Its evidence
    is the first positive assertion's failure: Vitest's "Cannot find element with locator:
    getByTestId('uf-root-…').getBy…", or "expect.poll() function didn't resolve in time.". Its
    verdict judges each (case, target) cell, which fails when any of the case's tests does, so a
    test that asserts only absences would pass beside one that fails; the spec rule that every
    test asserts a positive fact, not the canary, keeps such a test out;
  - `L5-debugger` and `L5-framework-rule` (ADR-0042);
  - `L1-fix-no-op` makes the first fixable diagnostic's fixes rewrite the source as it was, so
    applying them leaves the diagnostic. A canary may now name the cases it corrupts
    (`Canary.appliesTo`): this one, the cases whose committed `diagnostics.json` has a fix, and
    the compile project and the verdict read the same predicate.

  The M0 canaries are fitted to M1's shapes: `L10-root-hidden` hides a root with a
  `display: none` declaration, as an `<svg>` takes no `hidden` and a root's own `display`
  (`bindings/style-merge`) would override it; `L10-root-inverted` is an IR plugin that adds a
  `filter: invert(1)` declaration; the text canaries append `(canary)` to a text every render
  shows. A unit test runs every plugin canary on every case of the corpus and checks that it
  changes each case with output, on every target it corrupts, without UF8001.

- **CI runs the canaries as a matrix**, one job for each of `L1`, `L2`, `L3`, `L4`, `L5`, `L6`,
  `L7`, `L8`, `L11` and `L13`, and one for each of L10's two canaries, which both run the browser
  projects: one browser canary runs every spec on seven targets, so a job holds at most one, each
  inside the ten-minute budget (§7.9). `pnpm test:canaries` takes canary ids or layers, and
  `tests/integration/harness/canaries.unit.test.ts` holds the matrix to every canary, in exactly
  one job.

From `props/destructured-defaults`:

```ts
describeTargets("props/destructured-defaults", () => {
  it("renders every default when only the required prop is given", async () => {
    const view = await mountScenario(Notice, "defaults");
    await view.expectParity("defaults");
    await expect.element(view.getByRole("heading", { name: "Notice" })).toBeVisible();
  });

  // Browser-only: JSON cannot carry `undefined`, so this scenario has no SSR twin.
  it("takes the defaults for props passed explicitly as undefined", async () => {
    const view = await mount(Notice, {
      props: { message: "Backups run every night.", title: undefined, tone: undefined /* … */ },
    });
    await view.expectParity("explicit-undefined");
    await expect.element(view.getByRole("heading", { name: "Notice" })).toBeVisible();
  });
});
```

## Consequences

**Positive:**

- Every spec records every layer, so a run shows which layers a target fails, not only the first.
- A target that is not there yet can be quarantined at L8 and still keep the job green, which plan
  §9's "quarantine, then turn the column green" loop needs.
- Rerendering with new props is tested on seven targets, including defaults that come back when a
  key is removed (ADR-0034).

**Negative:**

- The harness reaches into Vitest's task result to clear a quarantined failure. A Vitest release
  that changes when hooks see `task.result` breaks it; the stub cases would show it.
- Qwik's rerender settles through the internal `_waitUntilRendered` (ADR-0018), and its wrapper must
  go through the optimizer.
- Astro's "rerender" is a fresh render: it proves new props render, not that a DOM updates.
- Most spec rules are convention, not checks; the L8 canary is what catches a spec that would pass
  against an empty render.
- The browser canaries run every spec on seven targets, and a canary makes every assertion wait
  for its timeout before it fails, so their time grows with the corpus: `L8-render-nothing`, the
  slowest, takes about a minute and a half locally, against a ten-minute job.
- The harness patches `expect.element` to bound it, a second reach into Vitest's internals.

**Open:**

- M2's L9 traces and interaction assertions extend L8 beyond static behaviour.
- A shard of a browser canary's job, once the corpus outgrows the ten minutes.

## Alternatives considered

- **An explicit wrapper, `view.expectBehaviour(async () => …)`.** No Vitest internals, but
  assertions outside it go unrecorded, and every spec must take its shape.
- **L8 as "pass if the test passed", with `expectParity` still throwing.** A parity failure would
  then show up as an L8 failure, or hide the spec's assertions altogether.
- **Solid's store with `reconcile` by `id`.** The default keeps proxies by `id`, so `key={item.id}`
  would look keyed on Solid and `key={item.slug}` would not: the harness, not the key, would decide.
- **A hand-built Qwik wrapper** (`componentQrl(inlinedQrl(…))`). It renders Qwik's error host.
- **One canaries job, or a job per canary.** One job runs every browser canary in a row, far past
  the budget; a job per canary repeats the install nineteen times for canaries that take a second.

## Evidence

- Vitest 5.0.3 runs the test, then the `requireAssertions` check, then `failTask` with the test's
  error, and only then the `afterEach` hooks. In a Chromium probe the setup's `afterEach` saw state
  `"fail"` with one `AssertionError`; setting the state to `"pass"` and clearing the errors reported
  the test as passed. The stub cases in `packages/testing/test/parity/cases/stub/behaviour*` and
  `packages/testing/test/behaviour.test.ts`, which reads the matrix they make, pin it: a
  quarantined L8 cell records `quarantined(#L8)` and passes, and a stale one fails.
- `expect.getState().assertionCalls` counts `expect.element` calls, which are built on
  `expect.poll`: the `behaviour` stub's test that asserts only through `expect.element` passes under
  `requireAssertions`.
- Qwik 2.0.0-beta.47 in Chromium: an optimizer-compiled `component$` wrapper given a
  `createSignal(props)` updates text, branches and keyed lists, restores a removed key's default
  and logs nothing, also from a file outside `srcDir`. A hand-built wrapper renders
  `<errored-host q:key="_error_">`.
- Svelte 5.57.1 with vite-plugin-svelte 7.3.1: a `$state` proxy from a `.svelte.ts` module, passed
  as `mount` props, updates, and deleting a key restores its `$props()` fallback, with no warning.
- Solid 1.9.15: a store with `mergeProps` defaults reapplies them for removed and `undefined` keys.
- Angular 22.2.1: `setInput(name, undefined)` restores a default only with ADR-0034's transform.
- Each adapter's rerender test, "replaces the props whole, updating text, attributes, branches and
  lists": `packages/target-{react,vue,svelte,solid,qwik}/test/rerender.browser.test.ts`,
  `packages/target-angular/test/rerender.test.ts` (with "reports a prop that is not an input, as at
  mount") and `packages/testing/test/astro-rerender.browser.test.ts`.
- `packages/testing/test/summary.test.ts` holds the scenario comparison, including "compares only
  once every project ran all its tests".
- `semantics/reactive-props` rerenders twice on all seven targets, a removed key included, and every
  corpus spec passes L8 on all seven.
- Vitest 5.0.3 gives `expect.element` the timeout its call names or, when the browser provider sets
  no action timeout, the test's remaining time (`resolveActionTimeout` in `@vitest/browser`): the
  project's `expect.poll.timeout` never reaches it, and a locator that never matches waited about 60
  seconds. Before `boundElementTimeout`, `L8-render-nothing` failed L8 on all 31 cases with output
  on all seven targets, 497 tests (469 with the locator error, 28 with the poll's bare timeout, so
  the message race predates the bound), in 910 s locally on an Apple M4 Max, and `L7-wrong-text`,
  `L10-root-hidden` and `L11-invalid-role` took about 375 s each.
- With the bound in place, the same canary's 497 failures were 444 with the locator error and 53
  with the bare poll timeout, in 94 s: the race remains, and the stack still names the assertion.
- With it, every one of the 19 canaries is caught on all seven targets, and each runs well inside
  the ten-minute job. Local times on an Apple M4 Max: `L1-diagnostic-added` 1.3 s,
  `L1-plugin-throws` 1.2 s, `L1-fix-no-op` 1.2 s (caught on exactly the nine cases with a fix),
  `L2-ir-attribute` 1.4 s, `L2-output-edited` 1.3 s, `L2-nondeterministic` 1.4 s,
  `L2-unformatted` 1.3 s, `L3-mismatched-closing-tag` 3.3 s, `L4-type-error` 3.5 s,
  `L5-debugger` 3.4 s, `L5-framework-rule` 3.5 s, `L6-wrong-text` 6.8 s, `L6-golden-guard` 18.2 s,
  `L7-wrong-text` 56.3 s, `L8-render-nothing` 95.5 s, `L10-root-hidden` 47.4 s,
  `L10-root-inverted` 22.5 s, `L11-invalid-role` 50.2 s and `L13-console-warn` 26.4 s. M0's 15
  canaries took 41.7 s in all.
