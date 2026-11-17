# ADR-0102: Versioned targets and `solid@2`

- **Status:** Accepted
- **Date:** 2026-11-17
- **Plan:** §5.7, §6, §9 M8, Appendix C, D7 (ADR-0011); amends ADR-0101 for Solid 2's hydration

## Context

Plan §5.7 says a framework's new major is an additive package, and M8 tests the claim with Solid
2.0.0, which shipped on 2026-11-17 with `@solidjs/web`, `@solidjs/compiler` and
`@solidjs/vite-plugin` 3.0.0. Target names were a closed union of seven, hard-coded in about 25
places, and a name becomes a path or a package in many of them (`__output__/<target>`,
`@unframework.dev/target-<target>`, `tests/toolchains/<target>`). The corpus, `tests/integration`,
holds Solid 1, and so does the sample design system. Solid 2 changes Solid's model as well as its
API: a read sees a write only once Solid flushes, `flush()` is refused in an effect's callback and
in `onSettled`, a write in an owned scope throws, `merge` takes `undefined` for a value, and an
error nothing catches stops every update on the page.

## Decision

- **Selector and id.** A configuration, `compile()`, the unplugin and the CLIs take a
  `TargetSelector`: a target's id, or its framework and major. `solid@2` selects the id `solid2`,
  and `solid` and `solid@1` select `solid`. Everything after config loading, and every path,
  package and project, uses the id: `@unframework.dev/target-solid2`, `tests/toolchains/solid2`,
  `__output__/solid2/`, `browser:solid2`, `UF_TARGETS=solid2`, `outDir/solid2/` and the packaged
  `./solid2`. `resolveFrom` and `targetOptions` are keyed by id. A major that doesn't exist,
  `solid@3`, is UF7003, and its hint names the newest, `solid@2`.
- **Opt-in.** `DEFAULT_TARGETS` stays the seven: a project that builds both Solid majors needs two
  Solid installs. `TARGET_NAMES` lists all eight, so the corpus, the coverage gate, CI and the
  canaries run `solid2`.
- **A fork.** `target-solid2` starts as a copy of `target-solid/src`, then moves to Solid 2.
  Targets never import each other, and a shared base would change `target-solid/src`.
- **Where Solid 2 resolves.** Solid 2 comes from a named catalog, `catalogs: solid2:`, after the
  flat one, which keeps Solid 1. It installs only in `target-solid2`, `tests/toolchains/solid2` and
  the `solid2` e2e app. Every solid2 layer loads Solid 2, its compiler and its Vite plugin from
  `context.toolchainDir`, as Angular's compiler stack does: L3 and the Vite plugin from there, L4
  through the toolchain tsconfig's `paths`, and L6 to L12 through `resolveSolid`, a `pre` plugin
  that resolves `solid-js` and `@solidjs/web` as that directory would. Solid stays out of Vite's
  dependency optimizer and the plugin's dedupe, which both resolve from the project root, and is
  served through Vite's pipeline on the server too. Each adapter throws if it loads Solid 1. A
  project with both majors points `package.resolveFrom.solid2` at a directory that holds Solid 2.
- **The mapping**, where it differs from Solid's (plan §6, ADR-0045 to ADR-0101):
  - `ref` is an inline `createState`, a signal whose read returns the last value written; a
    derived value is a function. The watchers' scheduler is queued at the write and calls `flush()`
    before pre and before post watchers, and their reactions live in detached roots, which keep the
    component's hydration keys the server's (`interactivity`, emulated).
  - Hooks run from `onSettled`; defaults are `merge` getters over `undefined`; contexts default
    to `null` and are their own providers; `class` takes an array; a boolean of an ARIA or
    enumerated attribute is its name, through `enumeratedValue`; listeners with options are added
    from the `ref`; and a `ref` that creates a computation is a factory, in a `ref` array.
  - An async setup is an async `createMemo` under `<Loading>`. Solid 2 hydrates its subtree in
    place only with the values its server render serializes, so the hydrate render keeps Solid's
    scripts and the adapter runs them: after hydration the awaits don't run again, and the rest of
    the setup does. The contract allows either (`3.semantics.md`, Async setup). This amends
    ADR-0101 for `solid2`; Solid 1 keeps `noScripts`.
- **The harness's rules.** The solid2 adapters revive Solid's scheduler as they mount and unmount,
  since an error a case throws on purpose (`sourcemaps/computed-throws`) stops every update on the
  shared page (ADR-0092, ADR-0106). The hydrate projects' SSR environment drops the `browser`
  condition the Vite plugin adds under Vitest, and both its sides compile hydratable.
- **L5.** eslint-plugin-solid 0.19's `v2-strict` rules, as errors, beside every rule Solid's
  config turns on: `prefer-show` and `no-react-deps`, which `v2` leaves off, and `no-innerhtml`
  off, as on Solid. `prefer-classlist` is off, since Solid 2 has no `classList`.
- **Versions.** `solid-js`, `@solidjs/web` and `@solidjs/compiler` 2.0.0, `@solidjs/vite-plugin`
  3.0.0 and eslint-plugin-solid 0.19.0, exact. Each is a final release, so `solid@2` is not marked
  experimental: the mark the plan kept was for a prerelease Vite plugin, which shipped as 3.0.0 the
  same day. The versions were under a day old, so they are in `minimumReleaseAgeExclude`.

## Consequences

**Positive:**

- A framework's next major is a package, a selector and a catalog. Solid 1's output, goldens and
  pins are unchanged.

**Negative:**

- The fork doubles the Solid code, and a fix to one Solid target may be needed in the other.
- `createState` is an inline helper in every output with state: Solid 2's own signal can't give
  Vue's read after write in a hook or a watcher.

**Open:**

- `solid@2` in the sample design system and in e2e package mode, which needs a nested Solid 2
  install and `resolveFrom.solid2` there.

## Alternatives considered

- **`solid` means Solid 2.** It would change every project's output, and §5.7 promises a new major
  is additive.
- **Solid 2 in `tests/integration` under an npm alias.** The outputs import `solid-js`, which
  resolves by their location, so an alias still needs a resolver, and the corpus would hold both.
- **Flush after each write.** `flush()` throws in `onSettled` and does nothing in an effect's
  callback, where Vue's hooks and watchers write and read.

## Drill

DRILL_PLACEHOLDER
