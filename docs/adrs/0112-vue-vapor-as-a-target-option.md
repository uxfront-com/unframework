# ADR-0112: Vue Vapor as a target option

- **Status:** Accepted
- **Date:** 2026-11-19
- **Plan:** §5.7, §6, §7.3, §9 M8, D7, D10, P2, P4; amends ADR-0011 (Vapor in M8 is this record) and
  ADR-0076 (`compile()` validates `targetOptions`)

## Context

Plan §5.7 promises "Vue 3.5 → 3.6 Vapor as an option", and ADR-0011 put it in M8. M8 deferred it
until Vue 3.6 is npm's `latest`: on 2026-11-19 `latest` is 3.5.45, and the release candidate is
3.6.0-rc.15.

Vapor is a compile mode of Vue 3.6, not a framework of its own. A component marked
`<script setup vapor>`, or `<template vapor>`, compiles to code that creates and updates the DOM
without a virtual DOM, in the same `.vue` file, from the same `vue` package. Its runtime differs in
places: a custom directive is a function of the element and a getter of its value
(`VaporDirective`), a Vapor app is `createVaporApp`, and a virtual-DOM component such as
`<Suspense>` renders in one only through `vaporInteropPlugin`.

`Target.options` and `resolveTargetOptions` existed, but no built-in target declared options, and
three gaps would have dropped one in silence (P2): `compile()` handed `targetOptions` to a target
unchecked, the unplugin had no `targetOptions`, so `defineTestConfig` and the preview compiled
without them, and Vue 3.5's compiler-sfc ignores `vapor` and builds virtual-DOM components with no
warning. Vue is the reference (D10), so the corpus can't move it to a release candidate.

## Decision

- **One mechanism.** `targetOptions: { vue: { vapor: true } }` turns Vapor on. There is no
  `vue@vapor` selector: ADR-0102's selectors name a framework major with its own target id, package
  and paths, and Vapor keeps Vue's id, package, files and `outDir/vue/`. The Vue target declares a
  Standard Schema, written by hand since its main entry imports only `ir` and `codegen`: `vapor` is
  a boolean, `false` by default, and any other key is an issue. The option is experimental while
  Vue 3.6 is a release candidate.
- **What Vapor emits.** The same component, marked once: `<script setup vapor lang="ts">`, or
  `<template vapor>` without a script. compiler-sfc reads `<script vapor>` as a `<script setup>`,
  and refuses a plain `<script>` beside a Vapor template alone, so a component whose plain block
  declares its injection keys takes an empty `<script setup vapor lang="ts"></script>`. vue-tsc
  checks a `<script setup vapor>` as a function, where an `export` is TS1184, so a component that
  exports types declares them in a plain `<script lang="ts">` beside it, as one that owns keys
  already does. A directive is a `VaporDirective`: `mounted` runs from a post-flush effect that reads
  nothing after its first run, `updated` from a post-flush watcher of the value behind `Object.is`,
  and `unmounted` from the cleanup the function returns. Vapor applies an element's directives in an
  order of its own, so the hooks go through Solid's inline queue, `queueHook`, which runs them in
  Vue's order. `vTextCaret` is a post-flush effect too. Every other output is Vue's.
- **Capabilities under options.** `Target.capabilitiesFor(options)` returns the cells a target's
  validated options change, and `capabilitiesOf(target, options)` in `@unframework.dev/codegen` is
  the matrix every reader uses: the compiler's capability check, the harness, `defineTestConfig` and
  the targets page. Vapor changes one cell: `directive` is emulated by `queueHook`. A reason a cell
  gives under an option names the option, since the diagnostic reads "The vue target does not
  support …".
- **`compile()` validates `targetOptions`.** It runs each selected target's schema before it
  emits, emits with the value the schema returns, and throws a `TypeError` whose message starts with
  `UF7004` and names the option's path, as the config loader reports it. A target without a schema
  keeps its options as given.
- **Every entry passes the option on.** The unplugin takes `targetOptions` and hands them to
  `createProject`. `defineTestConfig` and the preview hand the config's to it, and load the Vue
  target's Vapor toolchain, `@unframework.dev/target-vue/toolchain/vapor`, whose mount adapter
  registers for the project's `vue`.
- **UF7013, `vapor-compiler-too-old`.** With `vapor` on, the unplugin checks the compiler-sfc plugin-vue
  compiles with as the server starts, and the Vue packager the one that resolves from `outDir` before
  it writes anything. Each parses a Vapor file, since a package manager may hoist Vue 3.6's
  `@vue/compiler-vapor` where Vue 3.5's compiler-sfc finds it. A plain `unframework build` writes
  sources a consumer's bundler compiles, so it can't check.
- **The corpus runs Vapor as an option set.** The harness's registry,
  `tests/integration/harness/targets.ts`, maps `vue-vapor` to `{ target: "vue", options: { vapor:
true } }`. The id names everything an id names: `__output__/vue-vapor/`,
  `tests/toolchains/vue-vapor`, `harness/quarantine/vue-vapor.ts`, the projects `toolchain:`,
  `ssr:`, `browser:` and `hydrate:vue-vapor`, a parity-matrix column, `UF_TARGETS=vue-vapor` and the
  CI matrices. The run's targets are the built-in ones, then the option sets. `vue` stays the only
  reference, and `vue-vapor` never writes a shared expectation.
- **Its diagnostics are a record of its own.** The shared `__expected__/diagnostics.json` and
  `__output__/diagnostics.txt` keep the built-in targets' alone. The set's own diagnostics are in
  `__output__/diagnostics.vue-vapor.json` for every case, with a `.txt` beside it where it has
  errors, each labelled `"target": "vue-vapor"`. L1 compares them after the shared file.
- **Vue 3.6 resolves from the toolchain directory.** A named catalog, `vue-vapor`, holds Vue 3.6,
  and only `tests/toolchains/vue-vapor` takes it, so the reference stays on the flat catalog's 3.5.
  Every vue-vapor layer loads Vue, its compilers and plugin-vue from `context.toolchainDir`, as
  ADR-0102 has Solid 2 do. On the server, `vue` and every `@vue/*` package run inlined from their ES
  module builds, since Vapor's runtime, an ES module alone, imports internals of
  `@vue/runtime-dom` that its CommonJS build doesn't export. The adapters throw if `vue` lacks
  `createVaporApp`, and the client ones if a root isn't marked `__vapor`. A Vapor app takes
  `vaporInteropPlugin`, and an async root renders under a `<Suspense>` in a virtual-DOM app, as the
  Vue adapter's does.

## Consequences

**Positive:**

- A project gets Vue's Vapor components from the same source, and the corpus proves them at every
  live layer on Vue 3.6, beside Vue 3.5's.
- An invalid target option fails wherever a compile starts, and a Vapor build on Vue 3.5 is loud.
- A later option of any target reaches the same machinery: a schema, `capabilitiesFor` and an
  option set if the corpus should run it.

**Negative:**

- Two Vue majors live in the workspace, and the vue-vapor layers resolve Vue through a plugin of
  their own, which a change to Vite's resolution could break.
- CI runs two more matrix jobs, and the compile, toolchain, SSR, canary and bench jobs take longer.
- A component that exports types, and one that owns keys but has no script, are laid out apart from
  Vue's own, because of vue-tsc and compiler-sfc, not of Vapor.

**Open:**

- Once Vue 3.6 is npm's `latest`, the `vue-vapor` catalog moves to it, the experimental label goes,
  and the quarantine is reviewed.
- An app of Vapor components that renders `<Suspense>` needs `vaporInteropPlugin`. Whether a
  Vapor app should avoid `<Suspense>` instead is for a later record.

## Alternatives considered

- **A `vue@vapor` selector.** It would be a second spelling of one option (P3), and give Vapor an id
  of its own with its own `outDir` and package, though it shares Vue's.
- **Vapor as the Vue target's default.** Vue 3.6 is a release candidate, and Vue is the reference
  (D10): every target's expectations would move with it.
- **The reference on Vue 3.6.** It would put every shared expectation on a release candidate, and
  is a version bump of its own.
- **A Vapor flag on each mount in the corpus, with no option set.** The harness keys outputs, paths,
  projects and quarantines by a target string, so the set reuses all of it, where a flag would need
  a second key everywhere.
