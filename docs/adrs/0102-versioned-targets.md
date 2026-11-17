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

The eighth framework drill (M8): how long a new major took, and what it touched.

- **First commit:** `f3720bea`, 2026-11-17T11:43:41+02:00, the fork of `target-solid` unchanged.
- **D1 first green on eight targets:** `4966a86b`, 2026-11-17T14:12:45+02:00: format, lint and
  types, every unit suite, the corpus at every live layer on all eight targets, and its summary.
- **Elapsed:** 2 hours 29 minutes.
- **Golden files:** 423 under `cases/**/__output__/solid2/`, in 274 trees, one wherever
  Solid 1 has one.

Every other file the change touched, by area (231):

- **The target package, `packages/target-solid2`** (72): `packages/target-solid2/README.md`, `packages/target-solid2/package.json`, `packages/target-solid2/src/asserted.ts`, `packages/target-solid2/src/attributes.ts`, `packages/target-solid2/src/composable.ts`, `packages/target-solid2/src/composition.ts`, `packages/target-solid2/src/directive.ts`, `packages/target-solid2/src/generics.ts`, `packages/target-solid2/src/helpers.ts`, `packages/target-solid2/src/index.ts`, `packages/target-solid2/src/jsx.ts`, `packages/target-solid2/src/listeners.ts`, `packages/target-solid2/src/models.ts`, `packages/target-solid2/src/narrowing.ts`, `packages/target-solid2/src/props.ts`, `packages/target-solid2/src/render.ts`, `packages/target-solid2/src/setup.ts`, `packages/target-solid2/src/toolchain/client.ts`, `packages/target-solid2/src/toolchain/compile.ts`, `packages/target-solid2/src/toolchain/component.ts`, `packages/target-solid2/src/toolchain/guard.ts`, `packages/target-solid2/src/toolchain/hydrate.ts`, `packages/target-solid2/src/toolchain/index.ts`, `packages/target-solid2/src/toolchain/resolve.ts`, `packages/target-solid2/src/toolchain/server.ts`, `packages/target-solid2/src/untracked.ts`, `packages/target-solid2/test/attributes.test.ts`, `packages/target-solid2/test/behaviour.browser.test.ts`, `packages/target-solid2/test/composable.test.ts`, `packages/target-solid2/test/composition.browser.test.ts`, `packages/target-solid2/test/composition.test.ts`, `packages/target-solid2/test/emit.test.ts`, `packages/target-solid2/test/events.browser.test.ts`, `packages/target-solid2/test/fixtures.ts`, `packages/target-solid2/test/fixtures/Address.tsx`, `packages/target-solid2/test/fixtures/AsyncRuns.tsx`, `packages/target-solid2/test/fixtures/Coalesced.tsx`, `packages/target-solid2/test/fixtures/ForwardedSlot.tsx`, `packages/target-solid2/test/fixtures/KeyedRows.tsx`, `packages/target-solid2/test/fixtures/Lifecycle.tsx`, `packages/target-solid2/test/fixtures/ListedSelect.tsx`, `packages/target-solid2/test/fixtures/Listeners.tsx`, `packages/target-solid2/test/fixtures/NarrowedState.tsx`, `packages/target-solid2/test/fixtures/Narrowing.tsx`, `packages/target-solid2/test/fixtures/NumberText.tsx`, `packages/target-solid2/test/fixtures/OptionText.tsx`, `packages/target-solid2/test/fixtures/RowSlots.tsx`, `packages/target-solid2/test/fixtures/Runs.tsx`, `packages/target-solid2/test/fixtures/SelectRow.tsx`, `packages/target-solid2/test/fixtures/SelectRows.tsx`, `packages/target-solid2/test/fixtures/Swatch.tsx`, `packages/target-solid2/test/fixtures/UnmatchedSelect.tsx`, `packages/target-solid2/test/fixtures/Watchers.tsx`, `packages/target-solid2/test/lint-probes.ts`, `packages/target-solid2/test/lint.test.ts`, `packages/target-solid2/test/listeners.test.ts`, `packages/target-solid2/test/module-sources.test.ts`, `packages/target-solid2/test/modules.test.ts`, `packages/target-solid2/test/output.test.ts`, `packages/target-solid2/test/render-parity.browser.test.ts`, `packages/target-solid2/test/render-parity.test.ts`, `packages/target-solid2/test/rerender.browser.test.ts`, `packages/target-solid2/test/resolve.test.ts`, `packages/target-solid2/test/rewrites.browser.test.ts`, `packages/target-solid2/test/setup.test.ts`, `packages/target-solid2/test/sources.ts`, `packages/target-solid2/test/styles.test.ts`, `packages/target-solid2/test/toolchain.test.ts`, `packages/target-solid2/tsconfig.json`, `packages/target-solid2/tsdown.config.ts`, `packages/target-solid2/turbo.json`, `packages/target-solid2/vitest.config.ts`.
- **The compiler, the unplugin, the CLIs and the umbrella** (34): `packages/cli/README.md`, `packages/cli/src/package/index.ts`, `packages/cli/src/package/solid2.ts`, `packages/cli/test/package/helpers.ts`, `packages/cli/test/package/solid2.test.ts`, `packages/compiler/README.md`, `packages/compiler/package.json`, `packages/compiler/src/compile.ts`, `packages/compiler/src/config-types.ts`, `packages/compiler/src/config.ts`, `packages/compiler/src/index.ts`, `packages/compiler/src/targets.ts`, `packages/compiler/test/compile.test.ts`, `packages/compiler/test/config.test.ts`, `packages/compiler/test/directives.test.ts`, `packages/testing/README.md`, `packages/testing/package.json`, `packages/testing/src/cli.ts`, `packages/testing/src/config/index.ts`, `packages/testing/src/normalize/rules/framework-attributes.ts`, `packages/testing/src/normalize/targets.ts`, `packages/testing/src/targets/solid2.ts`, `packages/testing/test/config.test.ts`, `packages/unframework/src/cli.ts`, `packages/unplugin/README.md`, `packages/unplugin/src/detect.ts`, `packages/unplugin/src/ids.ts`, `packages/unplugin/src/plugin.ts`, `packages/unplugin/test/detect-solid.test.ts`, `packages/unplugin/test/ids.test.ts`, `packages/visual/src/cli.ts`, `packages/visual/src/preview/command.ts`, `packages/visual/test/cli.test.ts`, `packages/visual/test/preview-catalogue.test.ts`.
- **The test toolchains** (73): `tests/toolchains/README.md`, `tests/toolchains/astro/package.json`, `tests/toolchains/solid2/consumers/events/emit-payloads/Consumer.tsx`, `tests/toolchains/solid2/consumers/events/emit-payloads/MisuseEvent.tsx`, `tests/toolchains/solid2/consumers/events/emit-payloads/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/generics/constrained/Consumer.tsx`, `tests/toolchains/solid2/consumers/generics/constrained/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/generics/list/Consumer.tsx`, `tests/toolchains/solid2/consumers/generics/list/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/generics/scoped-slot/Consumer.tsx`, `tests/toolchains/solid2/consumers/generics/scoped-slot/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/generics/select/Consumer.tsx`, `tests/toolchains/solid2/consumers/generics/select/MisuseModel.tsx`, `tests/toolchains/solid2/consumers/models/component/Consumer.tsx`, `tests/toolchains/solid2/consumers/models/component/MisuseModel.tsx`, `tests/toolchains/solid2/consumers/models/component/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/models/several/Consumer.tsx`, `tests/toolchains/solid2/consumers/models/several/MisuseModel.tsx`, `tests/toolchains/solid2/consumers/models/several/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/semantics/models/Consumer.tsx`, `tests/toolchains/solid2/consumers/semantics/models/MisuseModel.tsx`, `tests/toolchains/solid2/consumers/semantics/models/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/default/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/default/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/default/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/fallback/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/fallback/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/fallback/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/forwarding/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/forwarding/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/forwarding/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/in-list/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/in-list/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/in-list/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/named/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/named/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/named/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/presence/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/presence/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/presence/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/prop-names/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/prop-names/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/prop-names/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/scoped-default/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/scoped-default/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/scoped-default/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/slots/scoped/Consumer.tsx`, `tests/toolchains/solid2/consumers/slots/scoped/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/slots/scoped/MisuseSlot.tsx`, `tests/toolchains/solid2/consumers/types/child-type-import/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/child-type-import/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/child-type-import/MisuseType.tsx`, `tests/toolchains/solid2/consumers/types/exported-types/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/exported-types/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/exported-types/MisuseType.tsx`, `tests/toolchains/solid2/consumers/types/extends-chain/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/extends-chain/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/imported-interface/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/imported-interface/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/intersection-props/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/intersection-props/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/package-types/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/package-types/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/shared-type/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/shared-type/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/shared-type/MisuseType.tsx`, `tests/toolchains/solid2/consumers/types/utility-types/Consumer.tsx`, `tests/toolchains/solid2/consumers/types/utility-types/MisuseProp.tsx`, `tests/toolchains/solid2/consumers/types/utility-types/MisuseType.tsx`, `tests/toolchains/solid2/output.oxlintrc.json`, `tests/toolchains/solid2/package.json`, `tests/toolchains/solid2/sheets.d.ts`, `tests/toolchains/solid2/tsconfig.json`.
- **The corpus's harness and expectations** (19): `tests/integration/budgets.json`, `tests/integration/cases/composables/use-media-query/__expected__/diagnostics.json`, `tests/integration/cases/diagnostics/composable-effect-order/__expected__/diagnostics.json`, `tests/integration/cases/semantics/composable-effect-order/__expected__/diagnostics.json`, `tests/integration/cases/semantics/composable-unmount-order/__expected__/diagnostics.json`, `tests/integration/harness/canaries.ts`, `tests/integration/harness/canaries.unit.test.ts`, `tests/integration/harness/consumers.ts`, `tests/integration/harness/hydrate-setup/solid2.ts`, `tests/integration/harness/projects.unit.test.ts`, `tests/integration/harness/quarantine.ts`, `tests/integration/harness/quarantine/solid2.ts`, `tests/integration/harness/sources.unit.test.ts`, `tests/integration/harness/summary.unit.test.ts`, `tests/integration/harness/toolchain-lint.unit.test.ts`, `tests/integration/harness/toolchain-modules.unit.test.ts`, `tests/integration/harness/toolchain-strictness.unit.test.ts`, `tests/integration/harness/toolchain.test.ts`, `tests/integration/package.json`.
- **The e2e suite** (16): `tests/e2e/apps/solid2/e2e/plugin/hmr.spec.ts`, `tests/e2e/apps/solid2/e2e/plugin/smoke.spec.ts`, `tests/e2e/apps/solid2/package.json`, `tests/e2e/apps/solid2/src/plugin/Greeting.css`, `tests/e2e/apps/solid2/src/plugin/Greeting.uf.tsx`, `tests/e2e/apps/solid2/src/plugin/Hello.tsx`, `tests/e2e/apps/solid2/src/plugin/Showcase.tsx`, `tests/e2e/apps/solid2/src/plugin/index.html`, `tests/e2e/apps/solid2/src/plugin/main.tsx`, `tests/e2e/apps/solid2/src/plugin/types.ts`, `tests/e2e/apps/solid2/tsconfig.json`, `tests/e2e/apps/solid2/tsconfig.uf.json`, `tests/e2e/apps/solid2/vite.config.plugin.ts`, `tests/e2e/harness/apps.ts`, `tests/e2e/harness/harness.unit.test.ts`, `tests/e2e/scripts/prepare-apps.ts`.
- **The repository's own tests** (2): `tests/repo/test/layering.test.ts`, `tests/repo/test/targets-page.test.ts`.
- **CI, versions and the workspace** (6): `.changeset/solid2-target-uxf-665.md`, `.github/workflows/ci.yml`, `.github/workflows/nightly.yml`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`.
- **Docs and records** (9): `AGENTS.md`, `apps/web/content/docs/3.reference/1.targets.md`, `apps/web/content/docs/4.tooling/1.configuration.md`, `apps/web/content/docs/4.tooling/3.bundler-plugin.md`, `apps/web/content/docs/4.tooling/4.packaging.md`, `apps/web/content/docs/4.tooling/5.testing.md`, `docs/adrs/0102-versioned-targets.md`, `docs/adrs/README.md`, `docs/plan.md`.
