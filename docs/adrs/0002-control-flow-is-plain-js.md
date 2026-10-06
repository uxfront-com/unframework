# ADR-0002: Control flow is plain JS, and `v-model` is the only directive

- **Status:** Accepted, amended by ADR-0036
- **Date:** 2026-10-01
- **Plan:** §11 C2; §3, §4.3, §4.6, §5.4, §6, R4, Appendix A, Appendix B, Appendix C

## Context

Every template target has its own control flow: `v-if` and `v-for` in Vue, `{#if}` and `{#each}` in
Svelte, `@if` and `@for` in Angular, `<Show>` and `<For>` in Solid. The source has to express
conditionals, lists and two-way binding once, in a form that lowers to each of them.

- v1 used Solid's `<Show>`, `<For>` and `<Switch>` / `<Match>` components (Appendix B).
- Solid's APIs in the source are a non-goal (§3).
- JSX is more expressive than any template language (R4).

## Decision

Control flow in the returned JSX is plain JS. The compiler lowers it from expression shape (§5.4).

- **Conditionals:** `cond ? <A /> : <B />`, `cond ? <A /> : null`, `cond && <A />`, and nested
  ternaries as else-if chains. A conditional or logical expression whose branches yield JSX becomes
  an `If` node.
- **Lists:** `items.value.map((item, index) => <li key={item.id}>…</li>)` over any array
  expression, with `key` on the callback's root. A `.map` call whose callback returns JSX becomes a
  `For` node.
- Every other expression stays an `Interpolation`.
- **Two-way binding:** `v-model={text.value}` is the only directive.
  - It works on `input`, `textarea` and `select`, on boolean and array checkboxes, and on radios.
  - Modifiers use Vue JSX's form: `v-model_trim`, `v-model_lazy`, `v-model_number`.
  - On components it is `v-model:open={x.value}`.
  - The value must be assignable: `ref.value` or `model.value`.
- Everything else is plain JS inside the handler, such as `event.preventDefault()`.

One line of the Counter (ADR-0001) and what each target makes of it (Appendix A):

```text
Source    {doubled.value > 10 ? <span>Big</span> : null}
Vue       <span v-if="doubled > 10">Big</span>
Svelte    {#if doubled > 10} <span>Big</span> {/if}
Angular   @if (doubled() > 10) { <span>Big</span> }
Solid     <Show when={doubled() > 10}> <span>Big</span> </Show>
React     {doubled > 10 ? <span>Big</span> : null}
```

## Consequences

**Positive:**

- The syntax is one that TypeScript users and models already know. It needs no imports, and tsgo
  checks it as ordinary code.
- Each target receives its native construct (§6), so the output reads as idiomatic code (G2).
- v1's control-flow components port mechanically: `<Show>` to a ternary, `<For>` to `.map`
  (Appendix B, M10).

**Negative:**

- Only a subset of JS is accepted in the tree. JSX in a variable, JSX returned from a helper, JSX
  passed as a non-slot prop, and early or conditional returns are diagnostics, with fixes where a
  mechanical rewrite exists (§4.6, R4). Authors used to React will hit these.
- `<component is>` works only over a statically known set of tags or components.
- `v-model` is not standard JSX. It type-checks because `unframework`'s JSX types accept it
  (ADR-0006, §5.6). React and Solid have no two-way binding, so it lowers to `value` plus `onInput`
  by input kind (§6).
- Every expression shape, and its nesting, needs corpus cases on all seven targets (M1).
- Other directives wait for M8's portable directives, such as click-outside and focus-trap.

## Alternatives considered

The plan records C2 as confirmed and lists no alternatives for it. These are the options its text
argues against:

- **Control-flow components, as in v1** (`<Show>`, `<For>`, `<Switch>` / `<Match>`). They are
  Solid's API, which is a non-goal in the source (§3). Ternaries and `.map` say the same thing in
  plain JS, and v1 code maps onto them mechanically (Appendix B).
- **Vue directives in JSX** (`v-if`, `v-for`, `v-slots`), as `vue-jsx-vapor` does (Appendix C,
  prior art). They would give a second way to write each conditional and list, against P3, and the
  plan rejects accepting every Vue JSX form (ADR-0007). `v-model` is kept as the one exception.
