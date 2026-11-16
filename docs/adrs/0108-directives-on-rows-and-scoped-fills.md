# ADR-0108: Directives on a list's rows and in scoped fills

- **Status:** Accepted
- **Date:** 2026-11-16
- **Plan:** §4.3, §6, §7.2 L5 to L12, §9 M8; P2, P4, P7; ADR-0060, ADR-0096, ADR-0099; amends
  ADR-0099 (a directive in a list's body, or whose value reads a scoped fill's props, is no
  longer UF1002)

## Context

ADR-0099 left two uses of a directive as UF1002: on an element in a list's body, and in a scoped
slot's fill whose value reads the fill's props. A tooltip on each menu item, or a focus trap on
the row being edited, needed a component of its own for each row.

Both limits had one cause. React and Qwik read a directive's value once per use, at the
component's top level (`useDirective(vTrace, () => label)` on React, a visible task that tracks
the value on Qwik). Both already follow each element one use renders. What they couldn't do is
give each element a value of its own, and a row's value (`v-tooltip={item.label}`) differs on
each row, as a fill's does on each call. Vue, Svelte, Solid and Angular apply a directive per
element already, inside `v-for`, `{#each}`, `KeyedFor`, `@for` and fills.

Two facts settle how React and Qwik can do it without a component per row:

- **React calls a ref callback written in place again at each render.** It runs the old
  callback's cleanup, then the new callback, with the same element. A callback written in a row
  reads the row's values.
- **Qwik calls a function `ref` again when it changes.** Qwik 2's `diffProps` patches a prop
  whose value is not the old one, and `applyRef` calls a function `ref` with the element. A
  function written in a row is a new one each time the row renders.

`react/no-multi-comp` is off in L5's React config (only the `correctness` and `suspicious`
categories are on), so a helper component would pass lint. It isn't needed.

## Decision

- **No UF1002 for either use.** The analyser lowers a directive in a list's body, and one whose
  value reads a scoped fill's props, as any other. `checkInvariants` no longer rejects a directive
  in a list's body.
- **Which uses take the new form.** A use whose value reads a name a list's callback or a scoped
  fill declares (the item, the index, a fill's props) passes its value from each element. Every
  other use keeps ADR-0099's form, wherever it is, so no existing output changes. Which form a use
  takes depends only on what its value reads, never on how often a child renders it.
- **React.** The component calls a second inline hook, `useElementDirective(vTrace)`, once per
  use at its top level, as the rules of hooks want. The element's ref callback is written in
  place and passes the value beside the element:
  `ref={(element) => traceRef(element, item.label)}`. The hook records each element with its value, and its sync runs `mounted`,
  `updated` behind `Object.is` and `unmounted` on each element apart, as `useDirective` does. An
  element with several needs (two directives, a native listener, a `<textarea>`'s caret) merges
  them into one callback, written in place as soon as one of its directives passes a value, by
  the rule a listener that reads the row already follows (ADR-0047). The listeners are then added
  again at each render, and a `<textarea>`'s `v-model` takes no caret callback (ADR-0060). The
  value is read as the getter at the top level reads one, with what a branch narrows asserted
  (`assertedValue`), since TypeScript keeps no narrowing of a property in a callback.
- **Qwik.** The element's list holds each element with the values of its directives that read
  the row, `{ element, values }`. Its `ref` is
  `collectValues(traceElements, [item.label, item.id])`, which returns the function `ref` Qwik calls. The values are read in the call's
  arguments, as the row renders, never in the function it returns, which Qwik calls outside the
  component's tracking: a value that also reads the component's state renders the row again when
  that state changes. A value that changed writes a new list, and each directive's task runs each
  element with its own value. An element that leaves its list keeps the values it last had, and
  the runner's `back` path adds it again with them. A directive of the same element whose value
  doesn't read the row still reads its value in its task, and an element with no such directive
  keeps ADR-0099's plain list.
- **Vue, Svelte, Solid, Angular and Astro** need nothing new. Astro still drops directives.

```tsx
{
  items.value.map((item) => (
    <li key={item.id} v-trace={item.label}>
      {item.label}
    </li>
  ));
}
```

React writes `ref={(element) => traceRef(element, item.label)}` with
`const traceRef = useElementDirective(vTrace);`, and Qwik writes
`ref={collectValues(traceElements, [item.label])}`.

## Consequences

**Positive:**

- An author puts a directive on each row, or in a scoped fill, with a value that reads the row or
  the fill's props, on all seven targets. Each element runs its own hooks with its own value.
- No component is added per row, so the output keeps one component per source component, and no
  state moves out of the author's component.
- `directives/rows` covers rows, a row with two directives, a row whose native listener sits
  beside its directive, a value that reads the component's state too, and a scoped fill, with
  every call counted element by element and directive by directive.

**Negative:**

- On React, an element whose directive passes a value adds its native listeners again at each
  render, and a `<textarea>` with such a directive and a `v-model` keeps React's caret, at the
  start of its text, as ADR-0060 already says for a callback written in place.
- On Qwik, a row's values cross the serialiser in the element list, as the row's data already
  does as state or props. A value it can't serialise fails the server render.
- Solid replaces a scoped fill's element when the child passes that row new props, so a directive
  there runs `unmounted` and `mounted` where the other targets run `updated` on the same element.
  That is Solid's slot lowering, with or without a directive. `directives/fill-props` pins it,
  quarantined on Solid's L8 and L12 under UXF-827.
- Two directives on one element run in attribute order on Vue, React, Svelte and Qwik. Solid
  unmounts them in the reverse order, and Angular mounts them in another, in a list's body or
  outside it. `directives/rows` counts each directive's calls apart, and the difference is left
  for a follow-up.

## Alternatives considered

- **A helper component per row or fill on React and Qwik.** It passes lint, but it moves the
  row's rendering into a component the author didn't write, which changes what reaches the
  row's props, and it gives each row its own instance for one directive.
- **Reading the value inside Qwik's `ref` function.** It's shorter, but Qwik calls the function
  outside the component's tracking, so a value that also reads the component's state would never
  render the row again when that state changes.
- **Keeping UF1002 for a value that reads both the row and the component's state.** Both targets
  can carry it, so the rule would narrow the feature for nothing (P2 asks only for what can't be
  lowered to be reported).
