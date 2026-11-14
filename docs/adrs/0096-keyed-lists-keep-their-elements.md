# ADR-0096: Keyed lists keep their elements

- **Status:** Accepted
- **Date:** 2026-11-14
- **Plan:** §4.5 (Keyed lists), §6, §7.8, §9 M8; P3, P7; ADR-0033, ADR-0035, ADR-0055, ADR-0095;
  amends ADR-0036 (its "M1 guarantees a list's content and order only", and Solid's `<For>`)

## Context

Plan §4.5 promises that reordering a keyed list keeps DOM identity, so focus and input state
survive. ADR-0036 left that out of M1: it guaranteed a list's content and order only, and said the
rule would arrive "with its own capability and `semantics/keyed-lists` case". Until now the
semantics page called it not guaranteed yet, and the cases that reorder or replace a list kept the
focus out of it (`state/array-replacement`, `events/list-handlers`).

The two new cases show where the targets stand. React, Vue, Svelte, Angular and Qwik key a row by
the source's `key` (`key`, `:key`, `{#each … (key)}`, `track`, `key`), so a row keeps its element
when its item moves or is replaced by a copy. Solid's `<For>` follows the items themselves: a
parent that passes the list again as new objects, or a write that maps one item to a copy, gives
the row a new element, which drops its focus and its typed text. Astro renders once on the
server, and nothing reorders a list there.

The cases also show a limit no framework can lift. A browser blurs an element that is moved in
the document, and each framework picks which elements it moves to reorder a list: for one swap,
Vue moved the focused row where React moved the rows around it. So the focus survives a reorder
only where the focused element keeps its place.

## Decision

- **The guarantee.** A keyed item keeps its element while its list reorders, and while the item
  is replaced by another object of the same key. The element follows the latest item, and keeps
  what it holds: its focus, its typed text, a ticked box. The focus stays where the focused
  element keeps its place and the rows around it move, and where its item is replaced in place.
  An element that is moved itself keeps its typed text, and may lose its focus: that stays outside
  the contract.
- **The capability.** `keyed-identity`, behavioural, as a static render is the same without it:
  - native on React, Vue, Svelte, Angular and Qwik, whose lists already key by the source's
    `key`;
  - emulated on Solid, through an inline helper, `KeyedFor` (below);
  - unsupported on Astro, for information: it renders a list once on the server.
- **No IR kind requires it,** as `hydration` (ADR-0095): every list asks for it, and only a
  reorder in the browser shows it. A spec that reorders or replaces a list's items requires it, and
  is skipped on Astro. The coverage gate exempts it with that reason, and the cases that require it
  are `semantics/keyed-lists` and `control-flow/keyed-reorder-focus`.
- **Solid's helper.** A list is `<KeyedFor each={source} by={(item, index) => key}>`, a helper
  over `<For>` printed after the component (P7). A memo maps each key to its latest item, and
  `<For>` renders the keys, which it follows by value, so a row stays while its key does. Each row
  reads its item through a memo of that map, and its index through `<For>`'s accessor. So the row's
  item and index are accessors, `item()` and `index()`, which the rewrite rules call, and which the
  branch callbacks read once, as they read a state's accessor. `by` takes them as values, as the
  source's key reads them. An item whose key an earlier item took still renders, under a key of
  its own that no update keeps, as `<For>` would render it (keys are unique at run time,
  ADR-0035).
- **Amends ADR-0036.** Its "M1 guarantees a list's content and order only" now reads: a list
  guarantees its content and order, and with `keyed-identity` its elements. Solid writes the
  keyed helper where ADR-0036's table writes `<For>`, and its `key` is printed, as `by`.

```text
Source   {entries.map((entry) => <li key={entry.id}>{entry.label}</li>)}
Solid    <KeyedFor each={props.entries} by={(entry) => entry.id}>
           {(entry) => <li>{entry().label}</li>}
         </KeyedFor>
```

## Consequences

**Positive:**

- A list keeps a row's focus, typed text and state on six targets, as Vue does, so the parity
  tests compare a list that reorders while the reader works in it.
- A Solid list keyed by its index now keeps its elements by position, as Vue's does, where
  `<For>` moved them with their items.

**Negative:**

- Every Solid list carries the helper, about twenty lines, and every row reads its item through
  a call. A row's memo runs again for every change of the list, and notifies the row only when
  its own item changes.
- The focus on an element its list moves still differs between the frameworks, and the contract
  says so instead of guaranteeing it.

## Alternatives considered

- **An IR kind requires it: every `For`.** The coverage gate would need no exemption. But Astro
  would report the info at every list, though nothing reorders one there, and the shared
  diagnostics of every list case would carry it. `hydration` made the same choice.
- **Stable object references on Solid** (a proxy per key, or `reconcile` from `solid-js/store`).
  A proxy is not the item, so `items.indexOf(item)` and `===` in a handler would fail, and
  `reconcile` writes into the objects it was given, which are the parent's.
- **Solid's `<Index>`.** It keeps rows by position, not by key, so a reorder would keep every
  element in place and change its content, as a list keyed by its index does.
- **Restore the focus after a move.** No framework does it, and an inline helper that watched
  `document.activeElement` around every update would be runtime behaviour the plan keeps out
  (P7).
