# ADR-0069: Composables compiled per target

- **Status:** Proposed
- **Date:** 2026-10-24
- **Plan:** §4.1, §4.2, §4.5, §5.3, §6, §8.2, §9 M5; D1 (ADR-0005); G2, P2, P4, P6, P7; R1; ADR-0045,
  ADR-0046, ADR-0047, ADR-0048, ADR-0053, ADR-0057; amends ADR-0045

## Context

Plan §4.1 and D1 (ADR-0005) put composables, logic shared between components, in `*.uf.ts` files
compiled per target. Today a `.uf.ts` import is UF1002, and ADR-0045 leaves it to M5. A design
system wants `useToggle`, `useControllableState` and `useMediaQuery` once, shipped to consumers who
write their own components by hand in each framework. Several forces shape the contract:

- **Idiom (G2).** A React user expects a custom hook, a Svelte user a `.svelte.ts` module with
  runes, an Angular user a function run in an injection context, a Qwik user a `use*` hook.
- **Setup runs once (ADR-0045), but not on React (R1).** A hook re-runs on every render, so what a
  caller reads in render and what client code reads later must differ there (ADR-0046).
- **Effect order.** React reorders a component's own effects (ADR-0048), and Solid's watcher queue
  is per file. A hook's effects can't join its caller's order on either.
- **Shared expectations.** Each case has one `__expected__/diagnostics.json` for every target. In
  M3, each lane that removed its target's interim error rewrote them. Six sibling composables lanes
  would conflict there.

## Decision

**The source.** A `.uf.ts` module holds named exports `use[A-Z]…`, each a setup body under
ADR-0045's rules, with no JSX.

- Each parameter is annotated, and its kind follows from its type: a **value** is read once, a
  **getter**, `() => T`, is read reactively, and a **callback**, any other function type, is called
  from client code.
- The last statement is `return { a, b }`, a shorthand object of state, derived values, functions
  and constants.
- UF2035 (`invalid-composable`, error) rejects `useId`, `useTemplateRef`, `provide`, `inject`, the
  `define*` macros, a call to another composable inside a `.uf.ts`, a default export, and a return
  of any other shape.

**The call.** `const { on, toggle } = useToggle(false)`, at the top level of a component's setup.
This is the one destructuring ADR-0045 allows, and it lowers to a `Use` setup item.

- Callers read returned refs through `.value`. Writing one is UF2036 (`composable-result-write`,
  error): change state through a returned function.
- A reactive read passed to a value parameter is UF2007 (`setup-once-read`). The fix wraps it in a
  getter.

**The API.** `ModuleApi.composables` lists a `ComposableApi` per export, which the resolver returns
and the project graph watches (ADR-0071):

- each parameter's kind and type, and each member's kind and type;
- for a returned function, whether it is async, client-only or pure, so a caller's output never
  depends on the composable's body;
- `hasEffects`, which the caller's `Use` item copies.

The IR adds `UfModule.composables`, the `Use` item, and these binding kinds, beside ADR-0070's
`import` and `moduleConst`:

- `argument`: a composable's parameter, read in its body by its kind (value, getter or callback);
- `usedState`: a returned ref of state, such as `on`, which the caller reads through `.value` and
  never writes (UF2036);
- `usedDerived`: a returned computed value;
- `usedFn`: a returned function, which carries its async, client-only and pure flags;
- `usedConst`: a returned constant.

Each `used*` kind follows the member's kind in `ComposableApi`, so a target reads a returned name
the way it reads its own state, derived value, function or constant.

**Per target**, one module per composable:

| Target  | Output module                                                                                     | What it returns                                                                    | The caller reads                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Vue     | `useToggle.ts`: the source with Vue's primitives (`shallowRef`, `watchPostEffect`), as components | `{ on, toggle }`                                                                   | as written                                                                                                         |
| React   | `useToggle.ts`: a custom hook on ADR-0046's machinery (`useState`, mirrors, stable functions)     | each ref's render value `x`, and its live reader `currentX`                        | `x` in render, `currentX()` in client code                                                                         |
| Svelte  | `useToggle.svelte.ts`, with runes                                                                 | an object of getters                                                               | `t.on`, keeping the object, since runes don't survive destructuring                                                |
| Solid   | `useToggle.ts`, with signals and memos                                                            | accessors                                                                          | `on()`                                                                                                             |
| Angular | `use-toggle.ts`: a function that needs an injection context                                       | read-only signals                                                                  | from a field initialiser, or `runInInjectionContext` in `ngOnInit` where an argument reads an input: `this.t.on()` |
| Qwik    | `useToggle.ts`: a `use*` hook (`useSignal`, `useComputed$`, tasks)                                | signals and `$()` QRLs. A getter argument becomes `useComputed$`, a callback a QRL | `on.value`, and `await toggle()`                                                                                   |
| Astro   | `useToggle.ts`, static                                                                            | initial values, with client code dropped                                           | constants                                                                                                          |

**React's live reader.** A hook re-runs on every render, so a ref's render value is that
render's. For each returned state or derived value `x`, the hook also returns `currentX`, a stable
function that reads the hook's mirrors (ADR-0046's live getters, such as `currentTotal`). Client
code in the caller, a listener or code after an `await`, calls it, so it sees a write the
composable's own functions just made. Where `currentX` clashes with another member's name, the
hook takes the next free name, by one rule that the hook and its callers both apply to the API, as
each target claims the names it adds (ADR-0045). In outline:

```ts
// useToggle.ts on React
return { on, currentOn, toggle };
// the caller
const { on, currentOn, toggle } = useToggle(false);
// render reads `on`; a listener reads `currentOn()`
```

**The cells:**

- `composables` is native on all seven targets.
- `composable-effect-order` changes only what client code does, so it is behavioural, with
  `interactivity` as its prerequisite. It is native on Vue, Svelte, Angular and Qwik, unsupported
  on React and Solid (UF4005, `composable-effect-order`, info), and inert on Astro, like Astro's
  other client-only cells. `semantics/composable-effect-order` pins it.
- A `Use` item requires `composables`, and one with `hasEffects` requires
  `composable-effect-order`. `requiredCapabilities` scans components only, on purpose: a
  composable's body reaches its caller through the `Use` item.

**Before each lane lands.** `Target.emitComposable` is optional in `codegen`. Where a target lacks
it, `compile()` reports UF1002 for that target's composable, and where its call site isn't built,
its branch for the `Use` item and the new binding kinds reports UF1002 too ("lands with this
target's composables lane"). No corpus case reaches either before every lane has landed.

**The pending cases.** No corpus case uses a composable or a module value binding until every
target's lane is in:

- Vue's composables lane writes the 12 rendering cases complete, with their sources, specs and
  `case.json`, under `tests/integration/pending/<area>/<case>/`, and the sources of three
  diagnostics cases under
  `pending/diagnostics/`. The case loader reads only `cases/`, so pending cases reach no project,
  no shared expectation and no coverage count.
- Each lane verifies with its target's `composable` test, through a shared helper that takes a
  fixed list of case ids and reads each from `pending/` or `cases/`. A case in neither fails it. The
  lane that finishes a target's call site also copies the pending cases into `cases/` in a scratch
  worktree, runs `UF_TARGETS=vue,<target> pnpm test:update`, its target's four projects, the
  analyser's tests and its target's tests, and commits none of it.
- One landing change, after every lane, moves all 15 cases into `cases/` in one
  `pnpm test:update`, green on all seven targets with no quarantine, and removes the composable
  exemptions whole.
- A lane bug the landing finds is fixed by a new change on that target, never in the landing.

The rendering cases are `composables/use-toggle`, `use-controllable-state`, `use-media-query`,
`getter-argument` and `callback-argument`, the four `modules/` cases of ADR-0070, and
`semantics/composable-read-after-write`, `composable-effect-order` and `composable-unmount-order`.
The diagnostics cases are `invalid-composable`, `composable-result-write` and
`composable-effect-order`.

**Tooling.** `.uf.ts` modules get virtual ids in the unplugin, such as `X.uf.ts.<ext>`, and
Svelte's `.svelte.ts`. M5's module-id spike settles the scheme through each framework's Vite plugin.

**What it amends.** ADR-0045 allows the destructuring of a composable's result, the `Use` item, and
imports of `.uf.ts` modules. This record builds the `.uf.ts` half of D1 (ADR-0005).

## Consequences

**Positive:**

- A composable reads as its framework's own idiom, so a design system can ship it to consumers who
  write components by hand (G2).
- The caller's output depends only on `ComposableApi`, never on the body, so editing a body
  recompiles the composable alone.
- No lane rewrites a shared expectation, and the cases land once, green everywhere.

**Negative:**

- Seven emitters for composables, and on React and Qwik two layers each.
- Effect order across a composable's boundary is declared, not matched, on React and Solid.
- The contract is narrow: `useId`, `provide`, `inject` and composables that call composables wait
  for later issues, and so do injection keys in `.uf.ts` modules (ADR-0054).
- The cases stay out of the corpus until the last lane, so a lane's bug shows up late.

**Open:**

- The virtual id scheme for `.uf.ts` modules, through Svelte's runes, the Qwik optimizer and
  Angular's `ngtscVirtual`. The module-id spike adds its section here.
- The semantics contract's entries for composables. Vue's composables lane adds them to this
  record, and the change that accepts these records adds them to `3.reference/3.semantics.md`.

## Alternatives considered

- **Expansion at the call site.** It would reuse each target's setup lowering, so parity would come
  almost free. It erases the abstraction (G2), breaks "compiled for each target", and needs
  per-file provenance in every span and binding id, infrastructure that would then be thrown away.
- **A hybrid: modules where easy, expansion on React and Qwik.** It pays for both mechanisms, and
  puts expansion on React, where a custom hook is the expected idiom.
- **Lanes against quarantined corpus cases**, as M3 did. Each lane would rewrite the same shared
  diagnostics expectations. Running the six lanes one after another instead would hold
  each lane for the one before it.
