# ADR-0012: Events and models take each target's naming convention

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D8; §3 (G2), §4.2, §4.5, §6, §7.1, Appendix A

## Context

`defineEmits` and `defineModel` declare events and models once in the source (ADR-0003). Each target
has to expose them as its framework's own API, because output must read as a senior developer of
that framework would write it (G2). The conventions differ:

- React and Solid use camelCase callback props.
- Svelte 5 uses lowercase event attributes, such as `onclick`.
- Qwik marks lazy-loaded callbacks with a `$` suffix and passes them as QRLs.
- Angular has `output()` and `model()`.

## Decision

For an event `change` and a model `open` (§6):

| Target  | Event `change`       | Model `open`                          |
| ------- | -------------------- | ------------------------------------- |
| React   | `onChange` prop      | `open` / `onOpenChange`, controllable |
| Vue     | `defineEmits`        | `defineModel`                         |
| Svelte  | `onchange` prop      | `$bindable`                           |
| Solid   | `onChange` prop      | `open` / `onOpenChange`               |
| Angular | `output()`           | `model()`                             |
| Qwik    | `onChange$` QRL prop | `open` / `onOpenChange$`              |
| Astro   | inert (UF4xxx)       | prop only                             |

A model is controllable on every target: it works bound and unbound (§4.5).

The Counter's event in each output (Appendix A):

```text
React, Solid   onChange?: (value: number) => void;          in CounterProps
Svelte         onchange?: (value: number) => void;          in Props
Qwik           onChange$?: QRL<(value: number) => void>;    in CounterProps
Angular        readonly change = output<number>();          on the class
```

## Consequences

**Positive:**

- Consumers in each framework use names that look native there.
- Specs use the source name, as in `view.emitted("change")`, so a cross-target test does not
  change per target (§7.1).

**Negative:**

- One event has several spellings across targets. Docs and examples have to show each target's
  name.
- The scheme lets names collide: a model `open` and an event `openChange` would both map to
  `onOpenChange` on React and Solid.
- Qwik's QRL listeners are asynchronous, so `emit` returns `void` and code must not depend on
  listener completion (§4.5).

## Alternatives considered

- **camelCase everywhere, including Svelte.** Svelte 5's own event attributes are lowercase
  (`onclick` in Appendix A), so an `onChange` prop would look foreign beside them, against G2.
