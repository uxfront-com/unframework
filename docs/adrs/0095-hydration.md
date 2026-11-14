# ADR-0095: L12 hydrates every case's server render

- **Status:** Accepted
- **Date:** 2026-11-14
- **Plan:** §7.2 L12, §7.3, §9 M8, R5; amends ADR-0024 (its "future L12 path"), ADR-0031 (rule
  4f), ADR-0049 (Angular's ids, and Solid's under hydration) and ADR-0060 (the textarea caret on
  Vue, Solid and Angular); answers the hydration half of ADR-0048's open item "M8: hydration
  (L12), and resumption on Qwik"

## Context

Plan §7.2 defines L12 as a server render that hydrates to the client's DOM without a mismatch,
and stays interactive. Until M8 nothing checked it. L6 renders on the server and L7 to L11 render
on the client, but no test put server HTML in a page and hydrated it, and only Astro's adapter
ever put server HTML in a page. ADR-0024 left `provideClientHydration()` to "the future L12
path", ADR-0048 left "hydration (L12), and resumption on Qwik" open, and ADR-0049 noted that
Solid's and Angular's ids differ across the boundary.

A framework's own mismatch signal does not cover the contract. Solid checks no text or attribute
when it hydrates, and keeps the server's DOM without a warning. React reports an attribute
mismatch only on the console, and keeps the server's value. The DOM check renames generated ids,
so it cannot see an id that hydration changed.

## Decision

- **A `hydrate:<target>` project per target** runs the browser specs again. Its `mount` and
  `mountScenario` ask Node for the case's server HTML, through the `ufHydrationRender` browser
  command, then hydrate it with the target's hydrate adapter. Everything after that is the same:
  settle, steps, traces, rerender and unmount. Every check a spec runs there is recorded as L12,
  its failure named by its sub-check. L10 doesn't run there, and the project writes nothing: it
  compares with the shared expectations, Vue's included.
- **The server HTML renders in the SSR environment of the project's own browser server,** through
  a plain Vite module runner, so one plugin pipeline compiles both sides, the golden guard and the
  canaries included. Vitest's own evaluator on that environment externalises `node_modules`,
  which loaded a second copy of a framework. Vitest also sets `noExternal: true` there, after
  every project plugin, so a harness plugin adds back the externals a toolchain names
  (`environments.ssr.resolve.external`), for packages that run only from Node: `react` and
  `react-dom`, `vue` and Angular's `rxjs`. Renders run at once. Angular's renderer queues its own,
  since two overlapping `renderApplication` calls lose a render's transfer state.
- **The toolchain contract** gains `vite("hydrate")`, an optional `hydrate` module that exports
  `hydrate: HydrateAdapter`, and `renderForHydration: HydrationRenderer` beside `renderToString`.
  A `HydratedComponent` reports the mismatches its framework signalled (`takeMismatches`). A target
  with no `hydrate` module declares its `hydration` cell unsupported.
- **L12's own sub-checks:**
  - `mismatch`: the framework's own signal, during hydration and at every later settle, and an
    error the hydrate adapter throws.
  - `ids`: the `id`, `for`, `headers`, `list` and `aria-*` id references, in document order, with
    their raw values, are the server HTML's.
  - `DOM`: in `mountScenario`, the hydrated root is the scenario's expected DOM, where a spec
    checks that scenario.
  - `client agreement`: the hydrated root is the same target's client render of the same props,
    mounted in a second root in a `<form>` of its own, so its controls join no group of the
    hydrated root's, then unmounted.
  - `console` (L13's checks) and `interactions` (the spec's own steps and assertions).
- **A spec must mount its case's main component,** which the server renders. The page checks it
  against the module its import loaded, by the URL the client environment served it at.
- **Normaliser rule 4f** applies in a hydrated tree only: it removes a bound control's first-state
  markup (`value`, `checked`, `selected`, a textarea's text) wherever the live `uf:*` state is
  serialised. The server writes that markup, hydration keeps it, and no client updates it, as
  rule 4e has react-dom keep its own (ADR-0060). L6 and L7 still check that markup.

| Target  | `renderForHydration`                                                               | Hydrates with                                                                         | `mismatch` signal                                                  |
| ------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| React   | `prerender` of the component alone, with no `<html>` shell                         | `hydrateRoot`, inside `act`                                                           | `onRecoverableError`, and the attribute mismatch's `console.error` |
| Vue     | `createSSRApp` with a root that renders the component                              | `createSSRApp` with the same root, its `warnHandler` set                              | a warning starting `Hydration`, and the page's summary line        |
| Svelte  | `render(…).body`                                                                   | `hydrate` with `recover: false`                                                       | `[svelte] hydration_*` warnings, and `hydration_failed`            |
| Solid   | `renderToStringAsync`, compiled hydratable                                         | `hydrate`, from a fresh `_$HY` and an unfinished `sharedConfig`                       | the error `hydrate` throws                                         |
| Angular | `renderApplication` with `provideClientHydration()` and `provideServerRendering()` | `createComponent` on the server's host, the marker and `ng-state` moved into `<body>` | an NG05xx through the `ErrorHandler`, and the NG0505 warning       |

- **The ids now match across the boundary on every target that hydrates.** React's server renders
  the component as the root, as `hydrateRoot` does: inside an `<html>` shell it sits after
  `<head>`, a fork that changes every id `useId` makes. Angular counts ids per application, with
  an injection token (`idCounter`), so the server and the client each start at 0. This amends
  ADR-0049. Solid needs no fix: under hydration `createUniqueId` returns the hydration context's
  id, the server's, and the `cl-` ids appear only in a client render, which corrects ADR-0049.
- **Fixes in the outputs that L12 found:**
  - A bound `<textarea>`'s caret is after its text once hydrated, as ADR-0060 has React put it
    after a client render: Vue's output declares a local directive, `vTextCaret`, Solid's a `ref`
    callback, `textCaret`, and Angular's a directive, `TextCaret`, which its `[value]` binding
    selects. Each empties the field and sets its text again, which fires no event. This amends
    ADR-0060.
  - Svelte reads a `modelText` field's first value into attributes it spreads, `{...nameField}`.
    Written as `value={…}`, the read joined the template's render effect, and once hydrated Svelte
    has dropped the value it remembers the attribute by (`remove_input_defaults`), so the effect's
    next run wrote the first value back over what the person typed.
  - Angular binds an option's `[defaultSelected]` before its `[selected]`. A hydrated option keeps
    the server's `selected` attribute, Chrome does not mark an option dirty when `selected` sets
    the selectedness it has already, and removing the attribute after it deselected the state's
    option.
- **The `hydration` capability** is native on React, Vue, Svelte, Solid and Angular, and
  unsupported, for information, on Astro, which runs nothing in the browser, and on Qwik. It is
  behavioural (`BEHAVIOURAL_CAPABILITIES`), since a target that doesn't hydrate renders the same
  markup. No IR kind requires it, so the case gate exempts it: the hydrate projects check every
  case. A hydrate
  project on a target that doesn't hydrate skips every test by that capability, first, and a
  diagnostics case, which has no spec, records its L12 as `no spec`.
- **Qwik resumes instead of hydrating, and L12 doesn't check it yet.** A spike resumed
  `state/counter`, but the corpus showed two limits of resumption itself. Qwik serialises no state
  for a component without client code, so a resumed one can't be given new props or unmounted. And
  a visible task runs once the loader sees its element, so watchers and `onMounted` change the
  first DOM later than a client render does. Checking resumption is left for later.
- **Two canaries** prove L12: `L12-client-text` changes an element's text in the client
  environment alone, so the server HTML stays right, and `L12-unwired-listener` removes every
  element listener there. Each target is judged on the sub-checks that can catch the first:
  `mismatch` on React and Vue, `mismatch` or `client agreement` on Solid, and `mismatch`, `DOM` or
  `client agreement` on Svelte and Angular, whose frameworks throw on some text changes and keep
  the server's text on others. The second is caught by `interactions` or `trace`.

## Consequences

**Positive:**

- Every case is checked as a server render that hydrates, on five targets, beside the client
  render, and four hydration defects of the outputs were found and fixed.
- The two sub-checks the frameworks miss, `ids` and `client agreement`, each fail on their own in
  the testing package's tests, so neither can pass by accident.

**Negative:**

- The hydrate projects run every spec again, with a second client render per mount, which adds a
  CI job per target.
- A hydrate project reads framework internals the frameworks do not promise (Angular's marker and
  transfer state, Solid's `_$HY`), which a release can move.
- Qwik's resumption, the reason its users choose it, is not checked.

**Open:**

- Checking Qwik's resumption: a component without client code, and the timing of visible tasks.

## Alternatives considered

- **The framework's own mismatch signal alone.** Solid checks no text or attribute, and React
  reports an attribute only on the console: a client-only change would pass on Solid.
- **Hydrating the stored SSR expectations.** They are normalised, with comments removed and ids
  renamed, so no framework can hydrate them.
- **A render server per project, as Astro's.** It worked, but compiles every component twice, in a
  second pipeline the golden guard and the canaries would have to reach separately.
- **Declaring the textarea caret instead of fixing it.** A declaration doesn't make the cell pass,
  and ADR-0060 judged the same caret on React a defect of the output, not noise.
- **Qwik's resumption as L12, with a host component the page drives.** It resumed the counter, and
  failed 330 of 514 tests on the corpus for the two reasons above.
