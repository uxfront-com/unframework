# ADR-0059: L4 consumer type tests: misuse fixtures with inline expectations

- **Status:** Proposed
- **Date:** 2026-10-08
- **Plan:** §5.6 (layer 4), §7.2 (L4), §7.7, §7.9, §9 M3, M5, M6; P1, P2; R2, R8; ADR-0022,
  ADR-0028, ADR-0042, ADR-0053, ADR-0054, ADR-0056

## Context

Plan §7.2 makes L4 live from M0 and adds consumer tests in M3: "a consumer file that misuses a
prop, event, model or slot must fail on every typed target". M3's exit criterion adds "mapped back
to `.uf.tsx`". L4 today runs one checker per target over every case's golden output (tsgo for
React, Solid and Qwik; vue-tsc, svelte-check, ngc and `astro check` on TypeScript 6, ADR-0022), and
fails on any error. A consumer test inverts that: the error must be there. Source maps, which
would map an error to the `.uf.tsx` line, are M6's (L14); M3 meets the exit criterion with `.uf.tsx`-keyed
expectations until then.

A misuse cannot come from the compiler: a `.uf.tsx` consumer that misuses a child is rejected by
layer 2 (ADR-0055's UF3035 to UF3039) before any output exists. What L4 proves is that each
output's public types stop a consumer written in that framework, the way a design system's users
write one.

## Decision

**Fixtures.** Consumer fixtures are hand-written in each target's language and reviewed like any
test, in that target's toolchain directory:
`tests/toolchains/<target>/consumers/<area>/<case>/<Fixture>.<ext>`. A fixture imports the case's
golden outputs by relative path (`../../../../../integration/cases/<area>/<case>/__output__/vue/Field.vue`)
and uses them as a consumer would. Each target's checker includes its `consumers/` tree: its
tsconfig's `include`, or the file list the harness gives `astro check` (ADR-0028). A fixture
outside the integration package cannot find the framework's types by Node resolution, so each
checker's tsconfig maps them with `paths` (`"react"`, `"react/*"`), as Angular's maps
`@angular/*` today; a correct React consumer there fails with `TS2307: Cannot find module 'react'`
without it. Each case with
fixtures has, per target, one correct consumer, which must check clean, and one fixture per
misuse kind the case's components declare: a prop, an event, a model, a slot. Lanes own their
target's tree, so no two lanes write one fixture.

**Expectations.** An expectation is a comment on the line before the misuse:

```tsx
// @uf-expect TS2322 Field.prop:label
<Field label={42} />
```

```vue
<!-- @uf-expect TS2339 Field.slot:hint -->
<template #hint="{ size }">{{ size.toFixed() }}</template>
```

It names the checker's code (`TS2322`, `TS2345`, `TS2339`, an `NG` code) and the declaration the
misuse breaks, as `<Component>.<kind>:<name>` with `prop`, `event`, `model` or `slot`. Markup takes
the HTML comment, code the line comment; an Angular inline template takes the HTML comment inside
it.

**Judging, inverted.** For each fixture, the checker's diagnostics must equal the directives:

- every directive is met by at least one diagnostic with its code on the line after it (Vue reports
  a model misuse twice, once each way);
- a missing expected error fails, as does any diagnostic on a line with no directive, and any
  error in a correct consumer;
- a directive's declaration must exist in the case's IR (`ir.json`, `ir.<Stem>.json`), or the
  fixture fails.

A failure names the fixture's line and the declaration's `.uf.tsx` line from its IR span:
`MisuseProp.vue:6: expected TS2322 for Field.prop:label (Field.uf.tsx:2), got none`. That is the
mapping to `.uf.tsx` before L14; once source maps exist (M6), the directive may name the line
instead.

**The layer.** The consumer check is a sub-check of L4 on the case's (case, target) cell, judged in
the same checker run (plan §7.3: one run per target). A fixture tree whose checker cannot start
fails every case that has fixtures, as L4 does.

**Feasibility.** The spikes ran one misuse of each kind on every typed target (Evidence). Each
cell is feasible except where the table says otherwise; an infeasible cell is declared in the
harness with its reason (`CONSUMER_GAPS`), and a fixture for a declared gap fails, so a gap is
never filled with a weaker check.

| Target  | Prop type, literal union | Event payload                              | Model type                                         | Slot props                                                                               |
| ------- | ------------------------ | ------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| React   | yes                      | yes                                        | yes, both directions                               | yes (`renderItem`)                                                                       |
| Vue     | yes                      | yes                                        | yes, both directions                               | yes                                                                                      |
| Svelte  | yes                      | yes                                        | yes, the value                                     | yes (`Snippet<[…]>`)                                                                     |
| Solid   | yes                      | yes                                        | the value; `onValueChange`'s setter is not checked | yes                                                                                      |
| Angular | yes                      | yes                                        | the value                                          | yes, through the slot directive's context guard (ADR-0056)                               |
| Qwik    | yes                      | yes                                        | yes, both directions                               | yes (`item$`)                                                                            |
| Astro   | yes                      | gap: Astro has no events (`interactivity`) | yes, as a prop                                     | scoped slots yes (render prop); named slots without props: gap, Astro does not type them |

Unknown names (an event, model or slot the child does not declare) are layer 2's, not L4's: some
checkers report them as excess properties, Vue and Angular templates do not.

**The canary.** `L4-consumer` corrupts each output's public types to `any`: every prop, event,
model and slot type a consumer sees. With it, every typed target's consumer check must fail on
every case that has fixtures, because their directives go unmet. It runs with the other
non-browser canaries in `.github/workflows/ci.yml`'s canary matrix, unsharded (ADR-0052 shards only
canaries whose browser specs run), and `canaries.unit.test.ts` covers it.

## Consequences

**Positive:**

- An output whose public types drift loosens nothing silently: the fixture that relied on them
  fails with the declaration's `.uf.tsx` line.
- The fixtures double as examples of each framework's consumer API for the docs.
- No compiler path writes a misuse, so L4's consumers do not depend on layer 2.

**Negative:**

- Fixtures are hand-written per target and per case: seven trees to keep in step with the corpus.
  A renamed prop breaks them in one run, loudly.
- A directive names a code, and a checker upgrade that changes the code fails the fixture; the
  upgrade then updates the directives.
- Positions inside generated code (vue-tsc's, svelte2tsx's, Astro's) could move an error to
  another line; the spikes found none.

## Alternatives considered

- **`@ts-expect-error`.** It has no form in Vue, Svelte and Astro markup or in Angular templates,
  and it neither names the code nor the declaration.
- **A JSON expectation file per target.** Line numbers in a second file drift from the fixture; a
  comment moves with its line.
- **Fixtures in the case directory.** The case directory holds target-independent sources and
  generated files; per-target hand-written fixtures there would put every lane in every case
  directory, which plan §9's lanes keep apart.
- **Consumers generated from a `.uf.tsx` with layer 2 turned off.** It would test the compiler's
  consumer output, not a framework user's, and need a mode that emits code the compiler rejects.

## Evidence

From ADR-0053's spike worktree: `spike/misuse` held `Field`'s golden output and one consumer per
misuse on every target, checked by `pnpm --filter @unframework/integration test -- --project
"toolchain:<t>" -t 'spike/'` (the fixtures sat in the case's `__output__` there). `Misuse`, the
correct consumer, checked clean on every target. Errors as each checker printed them:

- **Vue** (vue-tsc 3.3.11):
  - `MisuseProp.vue`: `TS2322 Type 'number' is not assignable to type 'string'. (line 6, column
11)`; `TS2322 Type '"loud"' is not assignable to type '"info" | "warn" | undefined'. (line 6,
column 22)`
  - `MisuseEvent.vue`: `TS2322 Type '(reason: number) => number' is not assignable to type
'(reason: string) => any'.`
  - `MisuseModel.vue`: `TS2322 Type 'number' is not assignable to type 'string'. (line 10, column
18)` and `TS2322 Type 'string' is not assignable to type 'number'. (line 10, column 25)`
  - `MisuseSlot.vue`: `TS2339 Property 'size' does not exist on type '{ length: number; }'. (line
7, column 24)`
- **React** (tsgo 7.0.2): `MisuseProp.tsx:4:17` and `:4:28` TS2322 as Vue's;
  `MisuseEvent.tsx:8:31` `TS2322 Type '(reason: number) => number' is not assignable to type
'(reason: string) => void'.`; `MisuseModel.tsx:8:17` TS2322 and `:8:31` `TS2322 Type
'Dispatch<SetStateAction<number>>' is not assignable to type '(value: string) => void'.`;
  `MisuseSlot.tsx:4:45` `TS2339 Property 'size' does not exist on type '{ length: number; }'.`
- **Solid** (tsgo): as React, except that `MisuseModel.tsx` reports only the value
  (`8:17 TS2322 Type 'number' is not assignable to type 'string'.`); `onValueChange={setCount}`
  passes.
- **Qwik** (tsgo): `MisuseEvent.tsx:10:31` `TS2322 Type 'QRL<(reason: number) => number>' is not
assignable to type '((reason: string) => void) | QRL<(reason: string) => void> | undefined'.`;
  `MisuseModel.tsx:9:12` and `:9:60` TS2322 both ways; `MisuseProp.tsx:6:17`, `:6:28` TS2322;
  `MisuseSlot.tsx:6:40` TS2339.
- **Svelte** (svelte-check 4.7.6): `MisuseEvent.svelte` `TS2322 Type '(reason: number) => number'
is not assignable to type '(reason: string) => void'. (line 11, column 22)`; `MisuseModel.svelte`
  `TS2322 … (line 9, column 13)`, one direction; `MisuseProp.svelte` both TS2322 (line 7);
  `MisuseSlot.svelte` `TS2339 Property 'size' does not exist on type '{ length: number; }'. (line
8, column 20)`.
- **Angular** (ngc 22.2.1, the same at L3): `misuse-prop.ts` TS2322 at line 10, columns 25 and 38;
  `misuse-event.ts` `TS2345 Argument of type 'string' is not assignable to parameter of type
'number'.` (line 10, column 59); `misuse-model.ts` TS2322 (line 10, column 26), once;
  `misuse-slot.ts` `TS2339 Property 'size' does not exist on type 'FieldHintContext'.` (line 12,
  column 42), with the slot directive; with a `#hint` template reference, no error.
- **Astro** (`astro check`, `@astrojs/check` 0.9.10): `MisuseProp.astro` both TS2322 (line 5);
  `MisuseModel.astro` TS2322 (line 7); `MisuseSlot.astro` `TS2339 Property 'size' does not exist
on type '{ length: number; }'.` (line 5, column 30) with the render prop, and `TS7031 Binding
element 'size' implicitly has an 'any' type.` with `Astro.slots.render`; `MisuseEvent.astro`
  only an excess-property TS2322 (`Property 'onclear' does not exist on type …`), since Astro has
  no events. `astro check` reported errors in a consumer against an imported output's `Props`,
  because the harness lists every file (ADR-0028's limit did not apply).
