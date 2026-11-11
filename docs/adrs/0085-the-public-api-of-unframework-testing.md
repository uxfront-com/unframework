# ADR-0085: The public API of `@unframework.dev/testing` is its root entry and the case

- **Status:** Accepted
- **Date:** 2026-11-11
- **Plan:** §7.1, §7.2 (L7, L11), §7.3, §8.5, §9 M7; ADR-0043, ADR-0049, ADR-0050, ADR-0057,
  ADR-0060, ADR-0061, ADR-0090

## Context

Plan §8.5 says a design-system team tests its own components "exactly the way Unframework tests
the compiler", with `describeTargets`, `mount`, `View`, `expectParity`, SSR scenarios and the axe
and ARIA matchers. M7 makes that API public. Until now nothing said which names were in it.

The root entry mixed two things. The 212 corpus specs use `describeTargets`, `it`, `mount` and
`mountScenario`, and 175 of them mount a scenario of their `case.json`. Beside those, the root
exported the harness's machinery: `registerTarget`, `cleanup`, `checkLayers`, `LAYERS`,
`LayerFailure`, `recordLayer`, the layer types, `HarnessContext` and the mount adapter types. No
spec imports any of them, and every name there is one a user could come to depend on.

The package had no matchers either. axe ran only as L11 inside `expectParity`. Vitest 5 ships
`toMatchAriaSnapshot()` and `toMatchAriaInlineSnapshot()`, but both read a target's raw tree,
without L7's normalisation, so Angular's hosts add spaces the other targets' trees lack, and a
generated id reads differently on each target. `toMatchAriaSnapshot()` also keeps one snapshot
per project, one per target, so it compares no target with another.

## Decision

- **The root entry is the public API, exactly.** Its runtime exports are `describeTargets`, `it`,
  `test`, `mount`, `mountScenario`, `allowConsole`, `capturedConsole` and `currentTarget`. Its
  types are the ones a spec writes: `View`, `ViewOptions`, `ComponentMountOptions`, `Props`,
  `NotAFunction`, `ViewUser`, `ClickOptions`, `ViewClock`, `TraceStep`, `SpecOptions`,
  `SpecTest`, `ParityOptions`, `PixelTolerance`, `ConsoleEntry`, `CaseConfig`, `SsrScenario` and
  `NoAxeViolationsOptions`. `tests/repo/test/testing-api.test.ts` pins both lists against the
  entry and this record, so a new name fails until both change.
- **The matchers are public too.** `@unframework.dev/testing/setup` registers them with
  `expect.extend`, and the root's types add them to Vitest's `Matchers`:
  - `toHaveNoAxeViolations(options?)` runs axe-core on the element with L11's options. It passes
    on no violation, or on exactly the rules `options.expected` lists, as `case.json`'s `axe`
    does for L11.
  - `toHaveAriaTree(expected)` compares Playwright's ARIA snapshot of the element with one tree
    that holds on every target. It normalises the snapshot as L7 normalises `aria.<name>.yaml`:
    Angular's hosts are inline while it's taken (ADR-0060), and generated ids are renamed
    (ADR-0049). Vitest's two ARIA matchers stay
    as they are, under their own names.
- **The case is the public test unit.** A case is a directory with one spec, its main `.uf.tsx`,
  any sources it composes (ADR-0057), an optional `case.json` and the generated `__expected__/`.
  The public fields of `case.json` are `ssr` (the scenarios `mountScenario` and L6 render),
  `axe` (the rules L11 expects), `colorScheme` (ADR-0061), `reference` (the target that writes the
  case's expectations, ADR-0057) and `main` (the source the spec mounts). `__expected__/` is
  generated and reviewed, never written by hand. `ssrThrows`, `requires` and `description` serve
  the corpus's own rules, and may change without notice.
- **Everything else is internal.** `./harness` holds the browser machinery the root exported
  before. The setup, the package's own tests and the `/<target>` entries import from it.
  `./setup`, `./node`, `./normalize` and `./<target>` stay internal too: a project's
  configuration loads them, and M7's `defineTestConfig` is to load them for it.
- **A lint rule holds the corpus to the public API.** `oxlint.config.ts` sets
  `no-restricted-imports` to `error` on `tests/integration/cases/**/*.{ts,tsx}`. It refuses any
  `@unframework.dev/testing/*` subpath, any other `@unframework.dev/*` package, and any relative path
  with a `harness`, `scripts` or `packages` segment, which reaches the harness's code or a
  package's source around its entries. `tests/repo/test/corpus-imports.test.ts` runs oxlint
  with the rule on a probe spec, with each kind of import. `ignorePatterns` keeps oxlint off
  `cases/diagnostics/`, so the rule doesn't reach it. No spec lives there, since a diagnostics
  case has none.
- **`"private": true` stays** until a release. Removing it, publishing the packages it depends
  on and their first versions under the names ADR-0090 gives them are a release decision. Until
  then the package packs,
  and `publishConfig.exports` names every subpath in `dist`.

```ts
import { describeTargets, it, mountScenario } from "@unframework.dev/testing";
import { expect } from "vitest";

import Counter from "./Counter.uf.tsx";

describeTargets("state/counter", () => {
  it("renders the initial count", async () => {
    const view = await mountScenario(Counter, "initial");
    await expect.element(view.getByRole("status")).toHaveNoAxeViolations();
  });
});
```

## Consequences

**Positive:**

- A user's spec and a corpus spec import the same names, and the lint rule keeps the corpus on
  them, so the corpus's 212 specs show every public name working on seven targets.
- A spec can check accessibility and the ARIA tree of any element, not only a scenario's
  container, with the same rules as L7 and L11.
- Harness changes that stay out of the root break no user's spec.

**Negative:**

- The case's layout and five `case.json` fields are now a contract. A change to them is a
  breaking change once the package is released.
- oxlint merges the `group` patterns of one rule into one list, and its regular expressions have
  no lookahead. So the subpath pattern is a regular expression, and only the package pattern
  uses a negated `group`. A later oxlint that changes either behaviour loosens the rule without
  an error, which is why `corpus-imports.test.ts` lints its probes with oxlint itself.
- A case directory can't be named `harness`, `scripts` or `packages`, since the rule would
  refuse a relative import of a file in it.
- The rule doesn't cover the sample design system's specs yet. M7's `defineTestConfig` work
  extends it to them.

## Alternatives considered

- **A scenario format of its own for users.** It would leave the corpus on a different API from
  the one users get, or mean rewriting 175 specs, and plan §8.5 asks for one way of testing.
- **Override Vitest's `toMatchAriaSnapshot()`.** It would change the meaning of a name Vitest
  documents, with a different signature, in every project that loads the setup.
- **Keep the machinery in the root and document which names are public.** Nothing would hold the
  line: a spec could import `recordLayer` and pass review.
