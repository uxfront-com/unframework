# ADR-0017: HTML attribute names and Vue event names in JSX

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D13; §2, §3, §4.1, §4.3, §4.6, §5.6, Appendix A, Appendix B, Appendix C

## Context

The JSX types decide which attribute and event names authors write.

- React's names (`className`, `htmlFor`, `onKeyDown`) differ from HTML's.
- The template targets (Vue, Svelte, Angular, Astro) use HTML attribute names, and Solid's and
  Qwik's JSX use `class` too (Appendix A). Only React's output needs `className`.
- The authoring APIs are Vue-inspired, and React is a target, not the authoring model (§3).
- v1 vendored its JSX types from Solid (Appendix B). Its ADR-003 kept vendored upstream types
  behind an owned alias, with probe tests that pin what they catch, and the plan keeps that
  approach (§2).

## Decision

- Elements use HTML attribute names: `class`, `for`, `tabindex`, `aria-*`, `data-*`.
- Events use Vue's JSX names: `onClick`, `onInput`, `onKeydown`. Event options are Vue's suffixes:
  `onClickCapture`, `onClickOnce`, `onClickPassive`.
- The intrinsic elements in `unframework/jsx-runtime` are vendored from `@vue/runtime-dom`'s JSX
  types, behind an owned alias, with probe tests (§4.1).
- React's names are diagnostics, each with a fix (§4.6):

| Written     | Fix         |
| ----------- | ----------- |
| `className` | `class`     |
| `htmlFor`   | `for`       |
| `onKeyDown` | `onKeydown` |

The Counter's root, in the source and in React's output (Appendix A):

```text
Counter.uf.tsx   <div class="counter">
React            <div className="counter" data-uf-c3a1>
```

## Consequences

**Positive:**

- The attribute names match HTML and every target except React, so six outputs keep them
  unchanged.
- Vue users already write these names.
- The JSX types are maintained upstream. The owned alias and the probe tests insulate the source
  from upstream changes.

**Negative:**

- React habits (`className`, `htmlFor`, `onKeyDown`) hit diagnostics. The fixes are mechanical.
- The vendored types have to be refreshed by hand when `@vue/runtime-dom` changes. The probe tests
  show what changed.
- Every target's emitter maps the event names to its own: `onClick` becomes `@click` in Vue,
  `onclick` in Svelte, `(click)` in Angular and `onClick$` in Qwik (Appendix A).

## Alternatives considered

- **React names (`className`, `htmlFor`, `onKeyDown`).** React's APIs in the source are a non-goal
  (§3). React is the only target whose output uses `className`, so React names would make the
  source differ from HTML and from the other six targets.
