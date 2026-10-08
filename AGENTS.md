# Unframework

Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik
and Astro components. The source is ordinary TSX with Vue-inspired APIs (`ref`, `computed`,
`defineEmits`, …) imported from `unframework` and erased at build time. The output has no runtime:
each file depends only on its framework. Every output is verified by executed tests, from golden
files and each framework's own compiler to server HTML, the DOM, the accessibility tree and pixels
in a real browser.

## Where the project is

- **M0, the walking skeleton, is done:** the whole pipeline and the verification machine, around
  static elements, text and attributes.
- **M1, props and static JSX, is done:** typed signature props with static defaults, expressions,
  conditionals, keyed lists, fragments, bound attributes, `class` and `style` in their literal
  forms, spreads with known keys and SVG, documented on unframework.dev (`apps/web/content/docs`).
  L5 (lint) and L8 (behaviour) are live.
- **M2, reactivity, events and behaviour, is done:** the setup as a scope-analysed subset in source
  order (`ref`, `computed`, `watch`, `watchEffect`, `onMounted`, `onUnmounted`, `nextTick`, local
  constants, functions and `let`s), element listeners with Vue's names and the capture, once and
  passive options, `defineEmits`, template refs, `useId`, and version 1 of the semantics contract
  with the differences it declares (`apps/web/content/docs/3.reference/3.semantics.md`). L8 drives
  interactions through `view.user`, and L9 (interaction traces) is live. Astro is declared static:
  its interactive tests are skipped by capability, visibly in the parity matrix. **M3, composition,
  is next** (plan §9).
- Anything outside the built subset is rejected as UF1002 (`unsupported-syntax`) until its
  milestone lands. The authoring types already accept the whole language (plan §4).
- The plan describes the target state. The code is the truth for what is built:
  - IR kinds: `packages/ir/src/types.ts`
  - capabilities: `packages/codegen/src/target.ts`
  - live layers: `LIVE_LAYERS` in `tests/integration/harness/quarantine.ts`
  - diagnostic codes: `packages/diagnostics/src/catalogue.ts`

## Read first

| Document                            | Read it                                                                                                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/plan.md`                      | For the architecture. Cited everywhere as §n, principles P1–P8, goals G1–G7, layers L1–L15, milestones M0–M10, decisions C1–C4 and D1–D13, risks R1–R14.                                                                                              |
| `docs/adrs/README.md` and the index | Before you reopen a decision. ADR-0018 to ADR-0033 record what the M0 spikes and build settled, ADR-0034 to ADR-0044 what M1 settled, ADR-0045 onwards what M2 settled. An accepted ADR is newer than the plan: where the two differ, follow the ADR. |
| `tests/integration/README.md`       | Before you touch the corpus or the harness.                                                                                                                                                                                                           |
| `packages/<name>/README.md`         | Before you change a package. Each README states the package's contract and its toolchain. Keep the README true when you change the contract.                                                                                                          |
| `.github/CONTRIBUTING.md`           | For scripts, the package template and releases.                                                                                                                                                                                                       |

## Layout

```
packages/        ir, diagnostics           pure data and the UF catalogue (no dependencies)
                 parser                    P1: oxc (TS-ESTree) and lightningcss; no TypeScript API
                 codegen                   the target kit: defineTarget, capabilities, JS/JSX/markup
                                           printers, oxfmt, the Toolchain contract (/toolchain-node)
                 analyzer                  P2 analyse (scopes through @typescript-eslint/scope-manager)
                                           and P3 lower the props, the setup and the returned JSX
                                           into IR
                 target-<name> ×7          emit() and capabilities; /toolchain{,/client,/server} for tests
                 compiler                  compile(): the passes in order, for each selected target
                 unplugin                  the Vite plugin (other bundlers in M6)
                 testing                   describeTargets, it, mount, view.user, expectParity,
                                           traces, normaliser, parity reporter (private until M7)
                 unframework               the authoring stubs and the JSX types (vendored from
                                           @vue/runtime-dom), with type probes
tests/integration  the corpus (cases/<area>/<name>/) and its harness (harness/, scripts/)
tests/toolchains   one per target: the checker, tsconfig and lint configs for its golden outputs
tests/repo         repo invariants: package layering, the package template, the diagnostics page
apps/web           unframework.dev: a Nuxt homepage and Docus docs (content/docs)
docs/              plan.md and adrs/
```

`compile()` runs these passes: parse, analyse and lower into IR, the `ir` plugin hook, the
capability check for each target, each target's `emit`, the `output` plugin hook, then oxfmt. It is
a pure function of its input. `packages/compiler-v1` is the gitignored v1 compiler, kept as a
reference only. Never import it, and never add it to the workspace.

## Commands

Use Node 24 or later. `packageManager` pins pnpm. Workspace packages export `src`, so tests and type
checks need no build first.

```sh
pnpm install                          # also installs the Chromium that the browser tests use
pnpm format:check && pnpm lint && pnpm check-types && pnpm test   # the full verify loop, as CI runs it
pnpm format                           # oxfmt; pnpm lint:fix for oxlint's fixes

# Narrower loops while you work
pnpm --filter @unframework/analyzer test                          # one package's own tests
pnpm --filter @unframework/integration test -- --project compile  # L1 and L2 only: the fastest corpus check
pnpm --filter @unframework/integration test -- --project "toolchain:angular"   # L3, L4 and L5, one target
pnpm --filter @unframework/integration test -- --project "ssr:svelte"          # L6, one target
pnpm --filter @unframework/integration test -- --project "browser:vue"         # L7 to L11, and L13
UF_TARGETS=vue,react pnpm --filter @unframework/integration test  # some targets only
pnpm --filter web build                                           # the docs: prerenders every page, fails on a broken link

# Commands that write artefacts (never in CI)
pnpm test:update                      # golden outputs and shared expectations; needs vue among the targets
pnpm test:baselines                   # the Linux screenshots and geometry, in Docker
pnpm test:baselines:check             # compare with them as CI does, in Docker
pnpm test:canaries                    # after a harness change: every live layer must catch its corruption

# Generated files
pnpm --filter @unframework/ir generate         # the IR's JSON Schema, after a change to the IR types
pnpm --filter unframework vendor:jsx           # re-vendor the JSX types after a bump of @vue/runtime-dom
pnpm --filter unframework probes               # the JSX type probes (they also run in its tests)

pnpm new:package <dir> "<description>"         # a new package; then add it to LAYERS (see below)
```

A run that names a project, applies a filter or sets `UF_TARGETS` is a partial run. Its summary
judges only what ran. CI's parity job requires every (case, target, layer) cell. The matrix is in
`tests/integration/.reports/parity-matrix.md`.

## Rules

### Done means green on seven targets

- A compiler change is done when the corpus is green at every live layer on all seven targets (P1).
  Emitted code alone is not done.
- If you intend to change the output, run `pnpm test:update`. Then review every changed file under
  `tests/integration/cases` as you would review code. The expectations are the contract.
- In update mode, only Vue, the reference target (D10), writes the shared expectations. Every other
  target must match them in the same run. A change to Vue's rendering changes the expectations of
  all seven targets.
- A feature is done when it also has its docs page (plan §9), in `apps/web/content/docs`. Every
  example there is copied verbatim from a corpus case's source and its reviewed golden outputs, so
  when `pnpm test:update` changes an output a page quotes, update the page too. Put
  `<!-- prettier-ignore -->` before each copied block: oxfmt formats a fenced block's code, which
  would change its whitespace.

### Never hand-edit generated files

Generate each of these with its command. The formatter and the linter skip them on purpose.

| Files                                                       | Command                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| `cases/**/__output__/`, `__expected__/`                     | `pnpm test:update`                          |
| `cases/**/__screenshots__/`, `__expected__/geometry.*.json` | `pnpm test:baselines` (Docker, linux/amd64) |
| `packages/ir/schema/`                                       | `pnpm --filter @unframework/ir generate`    |
| `packages/unframework/src/vendor/`                          | `pnpm --filter unframework vendor:jsx`      |

### Never weaken a check

- When a parity cell fails, fix the cause in the compiler or the target.
- Do not loosen normalisation. It removes only a framework's own noise (ADR-0031).
- Do not add pixel tolerance without a reason for that case.
- Do not delete an assertion. Do not add `.skip`, `.only` or retries.
- A known failure goes in `harness/quarantine.ts`, with a reason and an issue. A quarantined cell
  still runs and must still fail. An entry that starts to pass fails the run, so the list only
  shrinks.
- `harness/coverage-exemptions.ts` follows the same rule. Every IR kind, capability and diagnostic
  code needs a case, or an exemption with a reason.

### Loud, never silent (P2)

- Passes return diagnostics and never throw. `compile()` throws only for invalid options. A plugin
  or a target that throws becomes a diagnostic.
- Every construct that the compiler cannot lower is a diagnostic with a stable `UF` code from the
  catalogue. Nothing is copied into an output without analysis.
- A check that cannot start fails. Every skip names its reason: a capability or a quarantine entry.
- A flaky parity test is a bug in the compiler or in the harness. Never retry it.

### Deterministic (P8)

- The same input and the same versions give byte-identical output. Never put time, randomness,
  environment data, absolute paths or file-system order into output.
- The dependencies that shape output (oxc, oxfmt, and `@typescript-eslint/scope-manager`, which
  shapes the IR) are pinned exactly in the catalog.
- oxfmt formats code only: TS, TSX and JS files, Vue's and Svelte's script blocks and Astro's
  frontmatter (ADR-0041). Markup keeps the printer's whitespace-safe layout, because whitespace in
  a template changes the DOM (ADR-0026).

### Layering and TypeScript

- A package never imports a package on its own layer or above it. The order is `LAYERS` in
  `tests/repo/test/layering.test.ts`:
  1. ir, diagnostics
  2. parser
  3. codegen
  4. analyzer
  5. the targets
  6. compiler
  7. unplugin
  8. testing
  9. unframework, the umbrella, at the top

  Planned packages (type-oracle, cli, visual, …) already have their slots.

- A target's main entry imports only `@unframework/ir` and `@unframework/codegen`. Its `toolchain/`
  entries are for tests and tooling. Targets never import each other. Toolchain code that two
  targets share goes in `@unframework/codegen/toolchain-node`.
- The repo runs TypeScript 7 (tsgo). Only `type-oracle-tsgo` (from M5) and the test toolchains may
  load TypeScript's API. TypeScript 6 (`@typescript/typescript6`) lives only in
  `tests/toolchains/{vue,svelte,astro,angular}` and in `tests/toolchains/qwik-eslint`, the lint
  host that runs Qwik's type-aware rules (ADR-0045). The Angular compiler stack loads from
  `tests/toolchains/angular` and is never a package dependency.

### Targets and the IR

- **Targets own their idioms (P6).** Logic for one framework lives in its `target-*` package.
  `ir`, `analyzer` and `codegen` stay target-agnostic.
- **Idiomatic output (G2).** Each output must read as a senior developer of that framework would
  write it. It must pass that framework's compiler, type-checker and lint rules with zero warnings.
- **Differences are declared (P4, ADR-0033).** Each target declares a cell for every capability:
  `native`, `emulated` (with the name of its inline helper) or `unsupported` (with a UF4xxx
  diagnostic). Never let a difference show up only in a test.
- **No runtime (P7, D11).** An output imports only its framework. If a framework lacks a primitive,
  emit a small inline helper and declare it `emulated`.
- **The IR is plain JSON (P5).** Every node carries a span. Add a field only when a consumer reads
  it. Keep `checkInvariants` true (ADR-0032).

### The source language is fixed by the plan

- Each concept has one canonical form (P3, ADR-0007). Do not add an alternative syntax.
- JSX uses HTML attribute names and Vue event names (`class`, `for`, `onKeydown`).
- A change to the language, to a target's mapping (plan §6), to the harness's rules or to the
  layering needs an ADR.

### Versions

- Every version comes from the `catalog:` in `pnpm-workspace.yaml`, which holds plan Appendix C.
- The installed packages are newer than most training data: TypeScript 7, Vite 8, Vitest 5,
  Angular 22, Qwik 2 beta, Astro 7, oxc 0.152. Read their types and docs in `node_modules` before
  you use an API.

## Recipes

**Add a corpus case.**

1. Create `tests/integration/cases/<area>/<name>/<Name>.uf.tsx`.
2. Add `<name>.test.ts`, unless the case is in `diagnostics/`. Optionally add `case.json` for SSR
   scenarios and the expected axe rules.
3. Write the area, the name and every scenario in kebab-case. Name each scenario of `expectParity`
   with a string literal.
4. Run `pnpm test:update`.
5. Run `pnpm test:baselines` for the screenshots and the geometry.
6. Review every new file.

**Change what a target emits.**

1. Edit `packages/target-<t>/src`.
2. Run the target's own tests: `emit` and render-parity, which render through the real framework.
3. Run `pnpm test:update`, and read the diff of `__output__/<t>/`.
4. Run that target's `toolchain:`, `ssr:` and `browser:` projects.

**Add a diagnostic.**

1. Add an entry to `catalogue.ts` in its band (UF1 syntax, UF2 setup, UF3 JSX, UF4 portability,
   UF5 styles, UF6 types, UF7 config, UF8 plugins, UF9 internal). Give it a unique kebab-case
   `name`, a severity, a one-line title and a Markdown description that says how to fix the
   problem.
2. Never reuse or renumber a code.
3. Report it at the exact span.
4. If a mechanical rewrite exists, attach a fix with a confidence of `safe` or `likely`. The tests
   apply every fix and compile the result again.
5. Add a `cases/diagnostics/<name>` case that triggers it, or an `EXEMPT_CODES` entry with a reason.
6. Add its section to `apps/web/content/docs/3.reference/2.diagnostics.md`, under its band, with
   the catalogue entry's text and the anchor `[UFxxxx]{#UFxxxx}`: `docsUrl()` links
   `/diagnostics/UFxxxx`, which redirects there. `tests/repo` fails a section that differs from
   its entry.

**Add an IR node or attribute kind.**

1. Change `types.ts`, the builders, `walk` and the invariants in `packages/ir`.
2. Run `pnpm --filter @unframework/ir generate`.
3. Map the kind to a capability in `packages/codegen/src/capabilities.ts`. The records there fail
   type-checking until you do.

**Add a capability.**

1. Add it to `CapabilityName` and `CAPABILITY_NAMES`.
2. Give it a cell in each of the seven targets.
3. Cover it with a case, or with an `EXEMPT_CAPABILITIES` entry.

**Add a package.**

1. Run `pnpm new:package`, then `pnpm install`.
2. Add the package to `LAYERS`.

`tests/repo` fails a package that drifts from the template (plan §5.2):

- `exports` point at `src`, and `publishConfig.exports` point at `dist`.
- tsdown builds the package with `unbundle`.
- `isolatedDeclarations` is on.
- The Vitest tests are in `test/`.

**Record a decision.**

1. Take the next free number in `docs/adrs/`.
2. Fill in `template.md`.
3. Add a row to the index.
4. Run `pnpm exec oxfmt docs/adrs`.

Never rewrite an accepted ADR. Supersede it with a new ADR, or amend it with one.

## Target notes

These are the hard cells (plan §6). Each one has, or will have, its own `semantics/*` cases.

| Target  | Watch for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React   | The body re-runs on every render, but the source's setup runs once (R1): a setup `const` that reads the component is a `useState` snapshot, client code reads and writes written state through mirror refs, deferred code reads props through mirrors synced in `useLayoutEffect`, a function passed as a value is `useState(() => fn)`, and watchers are effects running effect events, the post ones and `watchEffect` gated until what pre watchers wrote has rendered. React prop names (`className`, `onKeyDown`). Where its synthetic events differ from the DOM's, it listens natively (`event-semantics`, emulated by `listen`); `once` and `nextTick` are emulated too (`useOnce`, `useNextTick`), and `class-binding` (`cx`). Branches that can render one tag at their top are keyed. Where React Compiler cannot compile the output, the component opts out with `"use no memo"`.                                                                                                                                                                                                |
| Vue     | The reference target: its output writes every shared expectation. The setup is copied as written, with `watchEffect` as `watchPostEffect` and template refs keyed by their binding's name. State not known to be a primitive is a `shallowRef`, watched through a getter. It renders single-selection list boxes differently, so `listbox` is unsupported. Every optional prop without a default gets `= undefined`, or Vue casts an absent boolean to `false` (ADR-0034).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Svelte  | Runes mode is forced (`<svelte:options runes>`). State not known to be a primitive is `$state.raw`, the setup's reads of props and state go through `untrack`, watchers are `$effect.pre` with their own previous value, and `onUnmounted` is `onMount`'s teardown, never `onDestroy`, printed after the watchers it must follow. `once` goes through an inline guard (`event-once`, emulated), every id derived from `$props.id()` has a suffix, and template refs are `T \| null` `let`s. Svelte drops whitespace and unmatched selectors, so the printer and the compiler-owned CSS scoping handle them. Never `class:` directives: they remove a token a dynamic class adds (ADR-0038).                                                                                                                                                                                                                                                                                                                                                                                                  |
| Solid   | Solid 1.9 now, `solid@2` as a separate variant later. The props are a proxy (`mergeProps`), so never destructure them: every read is `props.x`, and a list index is `index()`. Client code has no `batch`: watchers coalesce a run's writes through the inline `createWatcher`, a scheduler as Vue's (`interactivity`, emulated), and Solid renders each write as it is made; narrowed branches take accessor callbacks, not `keyed`, and a read a condition narrows takes `!`; template refs are `T \| null` `let`s the ref callback empties on cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Angular | Inputs are set after construction: a default takes a transform so that `undefined` applies it, and state, a setup `const` or a `let` that reads an input is read once in `ngOnInit`; watchers are effects created there, and a read a condition narrows takes `!`. Listener options are attribute directives (emulated); an element's several listeners of one event are one template listener that chains their statements, a `once` one behind a guard; a handler method returns nothing, since Angular prevents the default on `false`. Outputs keep the source's event names with the tuple payload rule (ADR-0047), and a setup binding of the same name is renamed. `nextTick` renders with `ApplicationRef.tick()` in a microtask, and teardown runs in `ngOnDestroy`, before the outputs stop. The host element wraps the root (`display: contents`, ADR-0010). There is no attribute spread, so spreads are written out per key. Its template parser bounds the expression subset (ADR-0035). TypeScript 6 checks the output. Virtual modules go through our ngtsc step (ADR-0027). |
| Qwik    | Experimental and pinned exactly (2.0 beta). Respect the QRL `$` capture rules and `track` in tasks: local functions that client code calls are `$()` QRLs, awaited where the call is a statement or its value is used, written in place where a later listener or a task must not wait, and held in `useConstant` when handed to `addEventListener`; statements are ordered so no `$` scope captures a later declaration. A control at the top of a listener becomes a `preventdefault:` attribute, one under a test of the event a `sync$` handler before the `$` one, and any other is `conditional-event-control` (an error). Hooks, post effects and `watchEffect` are `useVisibleTask$`, `onUnmounted` last. The adapter preloads every QRL, so a listener's first run is declared, not tested (ADR-0050). L3 runs the real optimizer, which lowers destructured defaults to `??`.                                                                                                                                                                                                      |
| Astro   | Static, with no client runtime: state is a constant of its initial value, and listeners, refs, effects, hooks and emits are dropped with what only they reach. `interactivity` is unsupported (info), so interactive tests are skipped by capability. `useId` counts on `Astro.locals`. SSR runs through the Container API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Code and prose

- **TypeScript and ESM, run directly by Node 24's type stripping.** `erasableSyntaxOnly` rules out
  enums, namespaces and parameter properties. Import local files with their `.ts` extension. Use
  `import type` for types (`verbatimModuleSyntax`). `isolatedDeclarations` needs explicit types on
  exports.
- **Tests.** Vitest 5 runs each package's `test/`. Files named `*.browser.test.ts` run in Chromium.
  The harness's own unit tests are `harness/*.unit.test.ts`.
- **Comments say why, not what.** Cite the plan (§, P, L, D) and the ADRs. Match the comment
  density of the code around you.
- **Prose** in docs, comments and messages is plain, with short declarative sentences and British
  spelling (analyse, normalise, behaviour, artefact). Code identifiers keep their established
  American names (`analyzer`, `normalize`).
- **Commits and PR titles** follow Conventional Commits, scoped where one area changes, as in
  `feat(web): …` or `fix(analyzer): …`. PRs follow `.github/PULL_REQUEST_TEMPLATE.md`. Every
  package is private at `0.0.0` until its first release. After that, a change to a published
  package needs `pnpm changeset`.

  <!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
