# ADR-0036: Conditionals test truthiness, lists need one keyed element, and children lower by shape

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §4.3, §4.5 (Keyed lists), §4.6, §5.3, §5.4, §6, §9 M1; P2, P3, P4; R4; amends
  ADR-0002

## Context

ADR-0002 makes control flow plain JS, lowered from expression shape: "a conditional or logical
expression whose branches yield JSX becomes an `If`", a `.map` whose callback returns JSX becomes a
`For`, and every other expression stays an `Interpolation`. M1 lowers all three on seven targets,
and two parts of that rule do not survive contact with them:

- **`&&` by JavaScript's value is not portable.** `{count && <b>items</b>}` renders `0` on React,
  Solid and Astro when `count` is 0, and nothing on Vue, whose `v-if` tests truthiness. Under
  ADR-0002, `{count && "items"}` (no JSX) is an Interpolation that renders `0` everywhere.
- **`||` and `??` with a JSX branch have no template form.** `{label || <em>none</em>}` renders the
  left value when it is truthy, which `v-if`, `{#if}` and `@if` cannot express without repeating it.

The children, branches and list bodies also need rules the plan leaves open: what a literal child
renders, how text runs merge, which empty branches survive, and where text may sit.

## Decision

`lowerChild(expression)` returns render nodes, recursively:

| Child                                          | Lowers to                                         |
| ---------------------------------------------- | ------------------------------------------------- |
| `{/* c */}`, `{null}`, `{undefined}`, `{""}`   | nothing                                           |
| `{true}`, `{false}`                            | nothing, and UF3016: always a mistake             |
| a string literal, a template literal, no `${}` | **Text**                                          |
| `c && X`, whatever `X` is                      | **If**: one branch, `c` and `lowerChild(X)`       |
| `c ? X : Y`, with JSX in `X` or `Y`            | an **If** chain; a nested `?:` or `&&` extends it |
| `c ? "a" : "b"`, with no JSX                   | **Interpolation**                                 |
| `src.map((item, index) => <el key={k} />)`     | **For**                                           |
| `<>…</>`                                       | its children, flattened into the parent           |
| any other expression                           | **Interpolation**, rendered as ADR-0037 says      |

- **Conditions test truthiness, as `v-if` does** (amends ADR-0002). Every `c && X` is an If,
  whether or not `X` holds JSX, so `0 && …` renders nothing on every target.
- **`x || <B/>` and `x ?? <B/>` are UF3025 `unsupported-conditional`** (amends ADR-0002), with the
  help "write `cond ? <A /> : <B />`".
- **After lowering, adjacent Texts merge** into one Text spanning the run (`a{null}b`, `a<></>b`).
  A final else branch with no children is dropped, and so is an If whose branches are all empty; a
  leading or middle empty branch stays, and each dialect prints what its idiom needs.
- **Placement looks through control flow.** The nesting tables (`REQUIRED_PARENTS`,
  `PERMITTED_CHILDREN`, …) see through If, For and fragments, so
  `<table>{rows.map((r) => <tr key={r.id}>…</tr>)}</table>` is UF3003. An Interpolation, or an If
  or For holding text, is UF3003 inside a textless element, `select` or `datalist`, and in SVG
  outside the text elements (ADR-0040). Inside `textarea` only static text is accepted: its content
  is its value, which is form state (UF1002 until M3). A leading `\n` in the first text of `pre`,
  `textarea` or `listing` is UF3017 `dropped-line-feed`.
- **The root** is an element or a fragment. A returned conditional or `.map` is UF1102 with a
  likely fix that wraps it in `<>…</>`; its content is still analysed, so the fix reveals nothing
  new. Each root of a fragment is a component root for the nesting tables (ADR-0010 for Angular).
- **Lists.** In child position, `source.map(callback)` takes an arrow with one or two plain
  identifier parameters (`item`, optional `index`) whose body is one JSX element, as an expression
  or as a block that only returns it. Anything else there is UF3015 `invalid-list`, which names the
  canonical form and suggests `.filter()` first for conditional items. A `.map` whose callback
  returns no JSX is an Interpolation, and UF3016 for its array kind. The source's value kinds must
  be within array and unknown (UF3018: write `items ?? []` for an optional prop).
- **Keys.** The body element carries `key={expr}`, lifted into `For.key`; without it UF3013
  `missing-key`, with a likely fix `key={index}` that adds the parameter under a fresh name. `key`
  anywhere else is UF3014 `misplaced-key` with a safe removal fix, except a static `key="x"` on a
  list body, which gets UF3013's fix instead. Key kinds must be within string, number and unknown.
- **M1 guarantees a list's content and order only.** Plan §4.5's "Keyed lists" rule, that a
  reorder keeps DOM identity, arrives later with its own capability and `semantics/keyed-lists`
  case; no spec asserts identity until then. Keys must be unique at run time (ADR-0035).
- **Each target writes its own construct** (plan §6). The capabilities `interpolation`,
  `conditional`, `list` and `fragment` are native on all seven.

```text
Source   {count && <b>{count} items</b>}
React    {count ? <b>…</b> : null}               (Qwik and Astro alike)
Vue      <b v-if="count">…</b>
Svelte   {#if count}<b>…</b>{/if}
Solid    <Show when={props.count}><b>…</b></Show>
Angular  @if (count()) {<b>…</b>}

Source   {items.map((item) => <li key={item.id}>{item.label}</li>)}
React    {items.map((item) => <li key={item.id}>…</li>)}   (Qwik alike; Astro without `key`)
Vue      <li v-for="item in items" :key="item.id">…</li>
Svelte   {#each items as item (item.id)}<li>…</li>{/each}
Solid    <For each={props.items}>{(item) => <li>…</li>}</For>
Angular  @for (item of items(); track item.id) {<li>…</li>}
```

- React, Qwik and Astro write ternary chains ending in `null`, never `&&`. Vue puts `v-if` on a
  single-element branch and uses `<template v-if>` otherwise, and never puts `v-if` and `v-for` on
  one element. Solid writes `<Show>` and, for longer chains, `<Switch>` and `<Match>`, with `{null}`
  for an empty branch; its `<For>` takes no key, and an index becomes `index()`. Astro drops `key`,
  which it would render as an attribute.

## Consequences

**Positive:**

- `&&` means one thing on seven targets, and it is what template authors expect.
- Every construct either lowers to each target's native control flow or fails with a code that
  names the canonical form.

**Negative:**

- `{count && "items"}` no longer renders `0`, which a React author may expect. The source's meaning
  is Vue's (ADR-0014).
- Authors used to `x || <Fallback />`, `.map` over fragments or conditional list items have to
  rewrite them.
- Keyed lists are not yet the identity guarantee plan §4.5 promises: Solid keys by item reference,
  and Astro has no client.

**Open:**

- The keyed-lists capability and its case: Solid and Astro will not be native.
- M3: lists of components, and slot content inside `.map`.

## Alternatives considered

- **Keep JavaScript's value semantics for `&&`.** React, Solid and Astro would stay as written, but
  the template targets would have to print the falsy value in an else branch, minus `false`, `null`
  and `undefined`, which no template author writes (G2). The source's meaning would no longer be
  Vue's `v-if` (ADR-0014).
- **Lower `x || <B/>` as `x ? x : <B/>`, or offer that as a fix.** It evaluates `x` twice and adds a
  second spelling of a conditional (P3). The ternary the help suggests says which value renders.
- **Accept a fragment or a conditional as a list body.** The key would need React's and Qwik's
  named `Fragment`, and Solid's `<For>` takes none; one element keeps one place for it.
  `.filter()` before `.map()` says the same as a conditional body.
- **Infer a key when the source omits it.** It hides the author's choice of identity, and React and
  Vue warn at run time without one.

## Evidence

- React 19.3 and Solid 1.9.15 render `{0 && <b/>}` as `0`; Vue 3.5.43's `v-if` renders nothing;
  Astro renders `0`. Solid's `Show`, `Switch` and `Match` test truthiness (`0`, `""` and `NaN` take
  the fallback). Vue renders a literal `{true}` child as `true`, React and Solid render nothing.
- Without children, Solid's `<Show when={c} fallback={…} />` and `<Match when={c} />` fail tsgo
  with TS2769.
- Vue renders `<template v-if>` inside `<textarea>` as literal text, and Svelte refuses `{#if}`
  there. Svelte's client sets an interpolated textarea's value property instead of its text, so its
  DOM differs from Vue's.
- Duplicate keys: Svelte's client throws `each_key_duplicate`, React logs an error and Angular warns
  NG0955; Solid and Astro accept them. Sparse arrays: Svelte's server renders a hole as
  `undefined`, Vue and Angular iterate holes, `.map` skips them.
- Angular 22 compiles `@for (item of items(); track index; let index = $index)` without a warning.
  Astro renders `<li key="0">` when `key` is kept.
- The `control-flow/*` cases are green at every live layer on all seven targets (to verify in M1).
