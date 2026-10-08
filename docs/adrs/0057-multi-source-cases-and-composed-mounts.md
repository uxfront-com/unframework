# ADR-0057: Cases hold several sources and compose through harness parents

- **Status:** Proposed
- **Date:** 2026-10-08
- **Plan:** §7.1, §7.3, §7.4, §7.7, §9 M3; P1, P2, P8; ADR-0014, ADR-0018, ADR-0021, ADR-0027,
  ADR-0029, ADR-0033, ADR-0043, ADR-0050, ADR-0053; amends ADR-0014 and plan §7.4 (a case may name
  its own reference target) and plan §7.3's mount options

## Context

The harness expects one `.uf.tsx` per case: `readCase` (`harness/cases.ts`), the golden guard
(`harness/guard.ts`) and the browser command `ufComponentEvents`
(`@unframework/testing/node`) each refuse a second source. Composition needs several: a child and
its parent, three levels, a harness parent that passes slots. Plan §7.3 has two ways to give a
component slots and models in a test: mount options (`mount(component, { props, slots, models,
on })`, slot content as a string or a harness component) or a harness `.uf.tsx` parent compiled to
the same target.

`coverage-exemptions.ts` also exempts `listbox`: Vue, the reference target, renders a
single-selection list box wrongly on its client (ADR-0033), so no case may hold one while Vue
writes the shared expectations. M3's form cases were to add one with "another reviewed source of
expectations".

## Decision

**A case's sources.**

- A case may hold several `.uf.tsx` files. With more than one, `case.json` names the main one,
  `"main": "Form.uf.tsx"`; the others are its children or its harness parents. A case with one
  source needs no `main`, so every existing case is unchanged.
- Every source compiles to every target, with `createFileResolver` (ADR-0053) rooted at the case
  directory. A source imports only files of its own case: anything else fails the compile
  project, so each case stays self-contained.
- **Golden files.** Every source's outputs share `__output__/<target>/`, each file named by its
  component (ADR-0053), so two components of a case may not share a name on any target. The main
  source's IR stays `__output__/ir.json`; each other source's is `__output__/ir.<Stem>.json`
  (`ir.Field.json`). Each is validated against the schema.
- **Diagnostics.** `__expected__/diagnostics.json` holds every source's diagnostics, each with its
  `file`, sorted by file then by span; `__output__/diagnostics.txt` frames them by file.
- **The guard** compares each compile event with the golden files of the components that compile
  produced, so a child's module is judged against its own files. The compile project fails a
  golden file that no source of the case produces, as it fails any stale artefact.
- **The spec** imports the main source only. `mountScenario` and SSR scenarios render the main
  component; `ufComponentEvents` reads the main source's compile.

**Specs compose through harness parents, not mount options.**

- A test that needs slots, children or a model writes the parent in `.uf.tsx`, as a source of the
  case, and mounts it: the parent passes the slot fills, binds the models with `v-model:<name>`,
  listens to the child's events and renders what it holds (`<output>{text.value}</output>`). The
  spec asserts on what the parent renders, and on `view.emitted` of the main component's own
  events.
- Mount options keep `props` and the listeners `mountScenario` attaches today. Plan §7.3's `slots`
  and `models` options are dropped, and so is `view.model(name)`.
- This is how the spikes ran (ADR-0053): every interactive target passed the form case's model and
  event tests that way. A harness parent also exercises each target's consumer output, which a mount
  option would bypass: Angular's `ng-template` slot directives and `[(value)]`, React's
  `renderItem`, Qwik's `item$`. Mount options would need each adapter to build framework slot
  content from strings or functions, which Astro's container and Angular's `projectableNodes`
  cannot do for scoped slots.

**Every project loads children through the unplugin.**

- The SSR and browser projects resolve an output's import of a child through the unplugin
  (ADR-0053). Astro's browser render server (`@unframework/target-astro/toolchain`) does the same:
  today it compiles only the module a spec imports, so a parent's import of `./Field.astro` fails.
- Angular's `ngtscVirtual` resolves and loads children first (ADR-0053, ADR-0056).

**The list box's expectations.** This puts ADR-0033's "another reviewed source of expectations"
into practice, and amends plan §7.4's one reference target for such cases. A case whose
expectations Vue cannot write sets
`"reference": "<target>"` in `case.json`. It is allowed only when the case requires a capability
whose Vue cell is unsupported (`listbox`), names a target whose cell is native, and keeps the
review rule: the files it writes are reviewed as Vue's are. `pnpm test:update` writes such cases
first, in a pass that runs only their reference's projects on them, and then runs every target as
usual; Vue's tests of the case are skipped by capability. `pnpm test:baselines` takes their pixels
and geometry from the same reference. M3's form case with a list box removes the `listbox`
exemption.

**Per-target quarantine files.** `harness/quarantine.ts` splits into one file per target
(`harness/quarantine/<target>.ts`), so each target lane edits only its own; `LIVE_LAYERS` and
`validateQuarantine` keep their behaviour.

## Consequences

**Positive:**

- A composition case is ordinary source on both sides, reviewed in its golden files and its IR,
  and every target's consumer output is tested by the same spec.
- No adapter learns to build slots, so the seven adapters stay the size they are.
- The list box gets a case, and the coverage gate loses its last capability exemption.

**Negative:**

- A test of a child through a parent asserts on what the parent renders, so a model's value is seen
  only as text the parent shows; a model whose value is not text needs the parent to render it.
- The update script gets a second pass, and `case.json` two keys, `main` and `reference`.
- The resolver runs in the compile project too: a case's compile depends on its other sources.

## Alternatives considered

- **Mount options for slots and models (plan §7.3).** Adapters would build slot content per
  framework, and scoped slots need functions that Astro's container cannot take; the consumer
  outputs would go untested.
- **The main source by a naming rule** (named like the directory). `events/emit-payloads` already
  holds `FileRow.uf.tsx`: no rule fits the corpus, and an explicit key reads plainly.
- **`ir.json` as an array of modules.** The schema validates one `UfModule`, and every existing
  case's `ir.json` would change.
- **Hand-written expectations for the list box.** They would be the only expectations no target
  writes, and nothing would regenerate them when the normaliser changes.
- **Leaving `listbox` exempt.** The coverage gate would keep a native capability without a case on
  six targets.

## Evidence

ADR-0053's spike harness made `readCase`, the guard and `ufComponentEvents` accept several sources
in a scratch worktree, with the main source named like the directory, and ran five two-source
cases (`spike/form`, `list`, `table`, `hazard`, `misuse`) on all seven targets:

- Vue wrote the shared expectations of four of them in update mode
  (`pnpm --filter @unframework/integration test:update -- --project "browser:vue" cases/spike`,
  then the `ssr:vue` and `toolchain:vue` projects with `-t 'spike/'`): 7 tests passed, writing
  `dom.*`, `aria.*`, `trace.*` and `ssr.default.html`.
- Svelte, Solid and Qwik then passed every browser cell of the four against them, React all but
  ADR-0058's `value` attribute, Angular all but ADR-0056's contextual roots. `Form` was a harness
  parent: its model, event and unbound-model tests ("binds the model and listens to the event",
  "keeps an unbound model local") passed L7 to L13 on the six interactive targets.
- Astro's browser project failed every spike case at mount with
  `Failed to load url ./Field.astro (resolved id: ./Field.astro) in …/Form.uf.tsx.astro. Does
the file exist?`; L3 to L6 passed. Its render server is the gap this record closes.
