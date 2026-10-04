# ADR-0043: L8 records the spec's own assertions, parity is soft, and every adapter can rerender

- **Status:** Accepted
- **Date:** 2026-10-02
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

- **Parity is soft.** `expectParity` records L7, L10 and L11 and resolves; it does not throw. The
  spec's assertions after it always run.
- **The setup's `afterEach` records L8** from the test's own errors, those that are not the
  harness's `LayerFailure`s, then throws one error that lists every failed layer. When L8 settles
  as quarantined, it removes the test's own errors from `task.result.errors` and, if no other layer
  failed, sets `task.result.state` to `"pass"`. A stale L8 entry fails like any other (§7.7).
- **A test-only escape**, `expectLayerFailure(layer, pattern)`, lets the testing package's
  self-tests consume a failure they expect. New stub cases prove L8 pass, fail, quarantined and
  stale, and the assertion rule.
- **Spec rules.** Browser projects set `requireAssertions: true`. Every test calls `expectParity`
  first, then asserts at least one positive fact about the rendered output (a text or a role is
  visible). Specs never branch on the target, and scenario names are unique within a case.
- **Scenarios come from `case.json`.** `mountScenario(Component, name)` mounts with
  `case.json`'s `ssr[name].props`, so an SSR scenario and its browser twin cannot drift. A
  browser-only scenario (an explicit `undefined`, which JSON cannot carry, or a rerender) says so
  in a comment. `expectParity` records its scenario, and the summary fails a (case, target) whose
  scenarios differ from Vue's.
- **Typed mounting.** `mount<P>(component: (props: P) => unknown, { props?: P })` and
  `rerender(props: P)`, so a spec cannot pass props the component's type rejects.
- **`rerender(props)` replaces the props whole** on `MountedComponent` and `View`, on all seven
  adapters: a key absent from the new props is removed, never set to `undefined`.

  | Target  | How                                                                            |
  | ------- | ------------------------------------------------------------------------------ |
  | React   | `root.render` inside `act`                                                     |
  | Vue     | a reactive props object behind `h()`                                           |
  | Svelte  | a `$state` proxy (`props.svelte.ts`): delete the absent keys, assign the new   |
  | Solid   | a store set without reconciling by `id`, so the harness invents no identity    |
  | Angular | `setInput` per key, `setInput(name, undefined)` for removed keys, `whenStable` |
  | Qwik    | an optimizer-compiled `component$` wrapper whose signal holds the props        |
  | Astro   | a new server render, its console captured for L13                              |

- **No feature case uses an unsupported capability in M1.** A construct one target cannot render
  is rejected for every target by the analyzer instead (ADR-0037), so no browser project loads a
  spec whose module failed to compile for its target, which would fail the whole file.
- **Live layers.** `LIVE_LAYERS` gains L5 and L8, the browser projects record L8, and a case
  without output (a diagnostics case) records neither. The canary `L8-render-nothing` replaces
  every component's render with an empty element (keeping only `prop` bindings, so the IR stays
  valid) and must fail L8 on every spec and target. The CI `canaries` job becomes a matrix, each
  job inside the ten-minute budget (§7.9).

```ts
describeTargets("props/destructured-defaults", () => {
  it("takes the defaults when the props are omitted", async () => {
    const view = await mountScenario(Badge, "defaults");
    await view.expectParity("defaults");
    await expect.element(view.getByText("New")).toHaveAttribute("data-tone", "info");
  });

  // Browser-only: JSON cannot carry an explicit `undefined`.
  it("takes the default again when a prop becomes undefined", async () => {
    const view = await mount(Badge, { props: { label: "New", tone: "warn" } });
    await view.expectParity("warn");
    await view.rerender({ label: "New", tone: undefined });
    await expect.element(view.getByText("New")).toHaveAttribute("data-tone", "info");
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

**Open:**

- M2's L9 traces and interaction assertions extend L8 beyond static behaviour.
- TODO(M1): the CI canaries matrix's shape (one job per canary or per layer) and each job's time.

## Alternatives considered

- **An explicit wrapper, `view.expectBehaviour(async () => …)`.** No Vitest internals, but
  assertions outside it go unrecorded, and every spec must take its shape.
- **L8 as "pass if the test passed", with `expectParity` still throwing.** A parity failure would
  then show up as an L8 failure, or hide the spec's assertions altogether.
- **Solid's store with `reconcile` by `id`.** The default keeps proxies by `id`, so `key={item.id}`
  would look keyed on Solid and `key={item.slug}` would not: the harness, not the key, would decide.
- **A hand-built Qwik wrapper** (`componentQrl(inlinedQrl(…))`). It renders Qwik's error host.

## Evidence

- Vitest 5.0.3 calls `failTask` with the test's error before running `afterEach` hooks. In a
  Chromium probe the setup's `afterEach` saw state `"fail"` with one `AssertionError`; setting the
  state to `"pass"` and clearing the errors reported the test as passed.
- `expect.getState().assertionCalls` counts `expect.element` calls, which are built on
  `expect.poll`. `requireAssertions` throws after the test, before `afterEach`.
- Qwik 2.0.0-beta.47 in Chromium: an optimizer-compiled `component$` wrapper given a
  `createSignal(props)` updates text, branches and keyed lists, restores a removed key's default
  and logs nothing, also from a file outside `srcDir`. A hand-built wrapper renders
  `<errored-host q:key="_error_">`.
- Svelte 5.57.1 with vite-plugin-svelte 7.3.1: a `$state` proxy from a `.svelte.ts` module, passed
  as `mount` props, updates, and deleting a key restores its `$props()` fallback, with no warning.
- Solid 1.9.15: a store with `mergeProps` defaults reapplies them for removed and `undefined` keys.
- Angular 22.2.1: `setInput(name, undefined)` restores a default only with ADR-0034's transform.
- M0's 15 canaries took 41.7 s locally, `L7-wrong-text` alone 5.9 s for two specs on seven
  targets. TODO(M1): the M1 canary suite's time, locally and per CI job.
