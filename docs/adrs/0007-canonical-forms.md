# ADR-0007: One canonical form per concept

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D3; §2, §3 (P3), §4.2, §4.3, §4.6, §5.9, §7.7, R13

## Context

Every way to write a concept is another lowering path on seven targets, more corpus cases, and
another choice for an author or an agent to get wrong (G4, R13).

- P3: one way to write each thing. v1 had three channels for props alone.
- Vue's JSX accepts several forms for some concepts, such as `v-slots` beside children, and
  `withModifiers` beside event options.
- The diagnostics catalogue carries stable codes with machine-applicable fixes (§5.9), so a
  non-canonical form can be rewritten rather than merely rejected.

## Decision

Each concept has one canonical form, and each concern has one channel.

| Concept                | Canonical form                                                                | Rejected, with a fix where one exists            |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Props                  | destructured signature props: `function Button({ size = "md" }: ButtonProps)` | none                                             |
| Models                 | a named model: `defineModel("open")`                                          | `defineModel()`, fixed to `defineModel("value")` |
| Default slot           | the JSX children                                                              | `v-slots`                                        |
| Named and scoped slots | a slot object as children: `{{ title: () => …, item: ({ item }) => … }}`      | `v-slots`                                        |
| Event options          | Vue's suffixes: `onClickCapture`, `onClickOnce`, `onClickPassive`             | `withModifiers`                                  |
| Attribute names        | `class`, `for`, `onKeydown` (ADR-0017)                                        | `className`, `htmlFor`, `onKeyDown`              |

- `(props: ButtonProps)` is also accepted for props, when nothing has a default.
- Anything an event modifier would do beyond those suffixes is plain JS in the handler:
  `event.preventDefault()`, `if (event.key === "Enter")`.
- A non-canonical form is a diagnostic, with a fix wherever a mechanical rewrite exists (§4.6).

## Consequences

**Positive:**

- People and agents learn, generate and review one form per concept.
- Fewer lowering paths: every form has corpus cases on every target, and the coverage gate can
  reach all of them (§7.7).
- The fixes are mechanical, so `unframework fix` can apply them (M9).

**Negative:**

- Code copied from Vue JSX or React needs rewriting. `v-slots`, `withModifiers` and `className` are
  all diagnostics.
- Unlike Vue, a model must be named.
- Every rejected form needs a catalogued diagnostic with a corpus case that triggers it, and every
  fix needs a test that applies it and recompiles (§5.9).

## Alternatives considered

- **Accept every Vue JSX form (`v-slots`, `withModifiers`).** It gives several channels for one
  concern, which is what P3 exists to prevent and what v1's three props channels showed. Each
  extra form would also multiply lowering work and cases across seven targets (R13).
