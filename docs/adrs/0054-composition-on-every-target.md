# ADR-0054: Composition constructs on every target

- **Status:** Proposed
- **Date:** 2026-10-08
- **Plan:** §4.1, §4.2 (Models, Slots, Expose, Options, Context), §4.3 (Two-way binding, Slots,
  Composition), §4.5, §4.6, §6, §7.8 (M3), §9 M3; P2, P3, P4, P6, P7; R1, R5, R6, R13; ADR-0007,
  ADR-0012, ADR-0033, ADR-0034, ADR-0039, ADR-0045, ADR-0046, ADR-0047, ADR-0048, ADR-0049,
  ADR-0053; amends ADR-0034, ADR-0036, ADR-0039, ADR-0045 and ADR-0047 (their deferrals to M3's
  fallthrough) and plan §6's starting mapping

## Context

Plan §6 gives a starting mapping for composition, and plan §4.2 and §4.3 the source forms. The M3
spikes (ADR-0053's Evidence) wrote a parent and a child by hand on every target and ran them
through the toolchain, SSR and browser projects. This record changes these rows of §6's
starting mapping, and the plan is updated from this list when M3 accepts it:

- **Fallthrough attributes:** `class` and `style` only, merged into the root, instead of `...rest`
  (React, Svelte, Qwik, Astro), `splitProps` (Solid) and the host or a helper directive (Angular).
- **`v-model`:** React writes `value` with `onChange`, not `onInput`; Qwik reads the value in
  render with `onInput$`, never `bind:value` (ADR-0058).
- **`slots.title` (presence):** native on Angular (a content query) and Qwik (a QRL prop), not
  emulated.
- **`slots.item?.({ item })`:** emulated on Angular (a slot directive) and Astro (a render prop)
  as well as Qwik, and React's render prop is named `render<Slot>`.
- **`provide` / `inject`:** unsupported on Astro, where §6 says "fallback only", because a
  rendering that differs from the other targets' must be declared (ADR-0033).

The spikes found why:

- **React** rejects a render prop named like a slot: oxlint's `react/no-unstable-nested-components`
  flags `hint={({ length }) => …}` in the parent (L5) and exempts props named `render…`.
- **Qwik** cannot serialise a function prop at SSR (`Code(Q3): Only primitive and object literals
can be serialized … because it's a function named "hint"`), and its `<Slot>` takes no props
  and has no presence API. A QRL render prop (`hint$`) serialises and re-renders.
- **Astro** loses a slot's arguments behind the `<Fragment slot>` its compiler writes
  (`Cannot destructure property 'length' of 'undefined'`), and `set:html` fails
  `astro/no-set-html-directive`. A render prop is typed and passes every layer.
- **Angular** needs a slot directive with a context guard to type a scoped slot's variables, has
  no way to tell whether a default slot received content, and moves only declared inputs off its
  host (ADR-0056).

The JSX types already bound the language: `ComponentAttributes` (`unframework/jsx-runtime`) lets a
consumer pass a component its props, `key`, `ref`, `class`, `style`, `v-model:<name>`, `onX` and
children or a slot object, and a component the content mapper has typed accepts only its props,
`ref`, `class` and `style`.

## Decision

**Slots.**

- A component declares its slots with `defineSlots<{ default?(): Element; title?(): Element;
item?(props: { item: Item }): Element }>()`, bound to a `const` (UF2006 otherwise). A slot with
  a parameter is scoped. A slot may not share a name with a prop, an event's callback or a model
  on any target (UF2029), because React, Solid, Qwik and Astro spell slots as props.
- It renders a slot as a child: `{slots.title?.()}`, `{slots.item?.({ item })}`, with fallback
  content after `??`, and tests presence with `slots.title` as a condition. Forwarding passes the
  slot itself in a slot object: `{{ title: slots.title }}`. Rendering `{slots.default?.()}` as
  another component's children forwards the default slot too, and lowers to the same fill, so it
  needs default-slot presence as well. Any other use is UF3041.
- A consumer passes the default slot as children, and every other slot in a slot object whose
  members are arrow functions returning JSX: `{{ default: () => …, item: ({ item }) => … }}`
  (UF3040 otherwise). A scoped slot's parameter is a destructuring pattern or an identifier; its
  names are `slotScope` bindings.
- **Fallback** renders when the consumer passes no slot. A slot that is passed but renders nothing
  renders nothing, where Vue would show its fallback: that case is outside the contract.
- **Presence** of a named slot is native on every target. Presence of the default slot cannot be
  read on Angular or Qwik (ADR-0056, ADR-0055's `default-slot-presence`), and forwarding the
  default slot needs it, since forwarding keeps presence.

**Models.**

- `const value = defineModel<string>("value", { default: "" })` declares a model; the name is
  required (UF2028, with a safe fix to `"value"`). The child reads and writes `value.value` as
  state; a consumer binds it with `v-model:value={text.value}`. `v-model` without a name on a
  component is UF3042, with a safe fix where the child has one model.
- **Controllable on every target (§4.5).** Bound, the model shows the consumer's value and a write
  asks the consumer to change it; unbound, the child keeps local state seeded by `default`. React,
  Solid and Qwik decide by `value === undefined`, so a model bound to `undefined` acts unbound
  there: outside the contract.
- **`v-model` on a native control** binds the control's state: the value of a text-like `<input>`
  (no `type`, or text, search, email, url, tel, password, date, time, datetime-local, month, week
  or color, which Vue binds as text), a `<textarea>` and a `<select>`; the checked state of
  a checkbox (a boolean, or an array with the box's `value`) and a radio (the radio's `value`); an
  array for `<select multiple>`. A number or range input casts with Vue's `looseToNumber`, as
  `v-model_number` does; `v-model_trim` and `v-model_lazy` follow Vue's `vModelText`. Anything
  else (a file, button or hidden input, a value that is not `ref.value` or `model.value`, a
  modifier on a control that has no text) is UF3042. On Astro every model and `v-model` renders
  its initial state and is inert: a component `v-model:<name>` and a control's `v-model` require
  `interactivity`, so Astro reports one UF4001 (info) for them, and `two-way-binding`,
  `model-array` and `model-modifiers` refine it (ADR-0055). A child that declares a model renders
  the prop's value there (`model` is native). A text field
  updates on `input` events;
  Vue waits for an IME composition to end, which no other target does: outside the contract.

**Fallthrough.**

- Only `class` and `style` fall through, as the JSX types say: a consumer's `class` and `style`
  merge into the child's root element (the union of the class tokens; the consumer's declaration
  wins for a property both set), or pass on to its root component. Any other attribute a child
  does not declare is UF3035 (`unknown-prop`, layer 2). A rest element in the props pattern
  becomes UF2001 (UF1002 until M3, ADR-0034's open item): there is one channel for fallthrough.
- **This departs from plan §6**, whose fallthrough row passes every undeclared attribute
  (`...rest`). A native listener does not fall through to a component's root (UF3036,
  ADR-0053). It also settles what ADR-0034, ADR-0036, ADR-0039, ADR-0045 and ADR-0047 left to M3,
  each with the code the analyser reports from M3 on:
  - **A spread of an object whose keys the compiler cannot see** (ADR-0039) is rejected for good:
    UF3048 (`open-spread`). A spread renders exactly the keys its type declares, and no target
    can render keys only the run time knows.
  - **A spread's `onX`, `key`, `ref` or `children` key** (ADR-0039, ADR-0047) is rejected for
    good: UF3049 (`reserved-spread-key`). A spread renders attributes; listeners, keys, refs and
    children each have their own channel.
  - **A spread of a setup value** (ADR-0045) stays UF1002, now landing in M5: a setup value's
    type is mostly inferred, which M5's type oracle reads. Its message names M5.
  - **A component whose root must sit inside a given parent** (`<li>`, `<tr>`, `<td>`, …,
    ADR-0036's UF3003 at a root) is accepted: the parent's compile checks the child's root tag
    (`ComponentApi.rootTag`) against the element the component sits in, and reports UF3003 there.
    Angular's cell is `contextual-root` (ADR-0056).
  - **A component whose root is an SVG element** stays UF1002, now landing in M8: its namespace
    comes from its parent, and Vue's templates have no way to declare it (Svelte has
    `<svelte:options namespace>`, Angular the `svg:` prefix). Its message names M8.
  - **A rest element in the props pattern** becomes UF2001, as above.
  - **JSX as an attribute's value** stays UF3012; its help stops promising M3 and suggests a slot
    or a component.
- `defineOptions({ inheritAttrs: false })` (a static object literal, UF2031 otherwise) makes a
  component take neither; a consumer that passes them is UF3045, as is one that passes them to a
  component whose root is a fragment, a conditional or a list.

**Expose and component refs.** `defineExpose({ focus })` takes an object literal of the
component's local functions, in shorthand (UF2030). A parent holds the component in
`const field = useTemplateRef<FieldApi>()` with `ref={field}`, where the type is an object type of
those functions, and calls them in client code (`field.value?.focus()`), as an element ref
(ADR-0049). A ref on a component that exposes nothing, or whose type names a member it does not
expose, is UF3046.

**Context.**

- **The key lives in the `.uf.tsx` module whose component provides it**, as an exported top-level
  `export const TabsKey: InjectionKey<Tabs> = Symbol("Tabs")` (UF2033 otherwise). This departs from
  plan §4.2, which puts it in a `.ts` module: a key's runtime form differs per target (a React or
  Solid context, an Angular `InjectionToken`, a Qwik context id), so it is compiled, and §4.1
  copies `.ts` modules unchanged. Each target writes the key into the output file of the module's
  main component. M5's `.uf.ts` modules may host keys later.
- `provide(TabsKey, value)` and `inject(TabsKey, fallback)` are setup items at the top level
  (UF2005 otherwise). A component that injects and provides one key reads its parent's value, as
  Vue does: its `inject` comes before its `provide` (UF2032 otherwise), and Angular injects with
  `skipSelf`, since its own `providers` would answer first. An injected value is read-only: a write through it is UF2034. Provide a
  function to let consumers change state. A provided ref or computed stays reactive.
- The Qwik context id is the key's description: two keys with one description in one application
  collide, so descriptions should be namespaced (`Symbol("acme.tabs")`).

**Dynamic components.** `<component is={href ? "a" : "button"}>` takes a conditional or a literal
whose leaves are all HTML tags or all components, or a prop typed as a literal union of tags.
Anything else is UF3044, which plan §4.6 asks for. Its attributes must be valid on every
candidate (UF3006 per tag).

**Lifecycle across components.** When a parent's `onMounted` runs, its children's DOM is in the
document, and its `onUnmounted` runs once the component is gone. Whether a parent's hook runs
before or after its children's is outside the contract: Vue, React and Svelte run children first,
and Solid's `onMount`, Angular's `afterNextRender` and Qwik's visible tasks run in their creation
order. `lifecycle/parent-child-order` checks only what the contract states (ADR-0048's open item).

**The mapping.** Every construct of plan §4.2, §4.3 and §7.8's M3 row, on every target. A cell
names the target's form; `helper` cells are emulated (ADR-0055); `UF4001` cells are unsupported.
The last rows point to the records of the constructs M1 and M2 built, unchanged by M3.

| Construct (source)                                         | React                                                                                      | Vue                                                                        | Svelte                                                         | Solid                                                              | Angular                                                                                                                       | Qwik                                                                 | Astro                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Child import, `<Field />` (ADR-0053)                       | `import Field from "./Field"`                                                              | `"./Field.vue"`                                                            | `"./Field.svelte"`                                             | `"./Field"`                                                        | `"./field"`, `imports: [forwardRef(() => Field)]`, `<uf-field>`                                                               | `"./Field"`                                                          | `"./Field.astro"`                                      |
| Static prop, `label="Name"`                                | `label="Name"`                                                                             | `label="Name"`                                                             | `label="Name"`                                                 | `label="Name"`                                                     | `[label]="'Name'"`, so the host keeps no attribute                                                                            | `label="Name"`                                                       | `label="Name"`                                         |
| Bound prop, `tone={tone.value}`                            | `tone={tone}`                                                                              | `:tone="tone"`                                                             | `{tone}`                                                       | `tone={tone()}`                                                    | `[tone]="tone()"`                                                                                                             | `tone={tone.value}`                                                  | `tone={tone}`                                          |
| Component event, `onClear={clear}`                         | `onClear={clear}`                                                                          | `@clear="clear"`                                                           | `onclear={clear}`                                              | `onClear={clear}`                                                  | `(clear)="clear($event)"`; `(ufChange)` for a DOM event's name (ADR-0056)                                                     | `onClear$={clear}`                                                   | dropped: `interactivity`, UF4001 (info)                |
| Three-level nesting                                        | each level as one                                                                          | each level as one                                                          | each level as one                                              | each level as one                                                  | each level imports its children                                                                                               | each level as one                                                    | each level as one                                      |
| Recursion                                                  | its own function                                                                           | `import Tree from "./Tree.vue"`                                            | `import Tree from "./Tree.svelte"`                             | its own function                                                   | its own selector, no `imports`                                                                                                | a named `component$` const                                           | `Astro.self`                                           |
| Component as a `.map` root                                 | `.map`, `key` on it                                                                        | `v-for`, `:key` on it                                                      | `{#each … (key)}`                                              | `<For>`                                                            | `@for (…; track …)`; a `contextual-root` is UF4001 (ADR-0056)                                                                 | `.map`, `key` on it                                                  | `.map`                                                 |
| `defineSlots<…>()`                                         | `children?: ReactNode`, `title?: ReactNode`, `renderItem?: (p) => ReactNode`               | `defineSlots<…>()`                                                         | `children?: Snippet`, `title?: Snippet`, `item?: Snippet<[P]>` | `children?: JSX.Element`, `title?: JSX.Element`, `item?: (p) => …` | `<ng-content>`; a directive `ng-template[ufFieldTitle]` per named slot, with `ngTemplateContextGuard`, read by `contentChild` | `<Slot />`; `title$?: QRL<() => JSXOutput>`, `item$?: QRL<(p) => …>` | `<slot />`, `<slot name="title" />`, `item?: (p) => …` |
| Default slot, `{slots.default?.()}`                        | `{children}`                                                                               | `<slot />`                                                                 | `{@render children?.()}`                                       | `{props.children}`, resolved once with `children()`                | `<ng-content />`                                                                                                              | `<Slot />`                                                           | `<slot />`                                             |
| Named slot, `{slots.title?.()}`                            | `{title}`                                                                                  | `<slot name="title" />`                                                    | `{@render title?.()}`                                          | `{props.title}`                                                    | `[ngTemplateOutlet]` under `@if`: helper `uf<Component><Slot>`                                                                | `{title$?.()}`: helper `<slot>$`                                     | `<slot name="title" />`                                |
| Scoped slot, `{slots.item?.({ item })}`                    | `{renderItem?.({ item })}`                                                                 | `<slot name="item" :item="item" />`                                        | `{@render item?.({ item })}`                                   | `{props.item?.({ item })}`                                         | `[ngTemplateOutletContext]="{ item }"`: helper `uf<Component><Slot>`                                                          | `{item$?.({ item })}`: helper `<slot>$`                              | `{item?.({ item })}`: helper `<slot>` render prop      |
| Fallback, `{slots.default?.() ?? label}`                   | `{children ?? label}`                                                                      | `<slot>{{ label }}</slot>`                                                 | `{#if children}…{:else}{label}{/if}`                           | `{content() ?? label}`                                             | `<ng-content>{{ label }}</ng-content>`; `@if … @else` for a named slot                                                        | `<Slot>{label}</Slot>`; `title$ ? … : label`                         | `<slot>{label}</slot>`; `item ? … : label`             |
| Presence of a named slot, `slots.title ? … : …`            | `title != null`                                                                            | `slots.title`                                                              | `title`                                                        | `props.title`                                                      | `title()`, the content query                                                                                                  | `title$`                                                             | `Astro.slots.has("title")`; a scoped slot's prop       |
| Presence of the default slot                               | `children != null`                                                                         | `slots.default`                                                            | `children`                                                     | `props.children`                                                   | UF4001 (error)                                                                                                                | UF4001 (error)                                                       | `Astro.slots.has("default")`                           |
| A slot rendered inside `.map`                              | in the `.map`                                                                              | in the `v-for`                                                             | in the `{#each}`                                               | in the `<For>`                                                     | in the `@for`                                                                                                                 | in the `.map`                                                        | in the `.map`                                          |
| Forwarding, `{{ title: slots.title }}`                     | `title={title}`, `renderItem={renderItem}`                                                 | `<template v-if="slots.title" #title="p"><slot name="title" v-bind="p" />` | `title={title}`                                                | `title={props.title}`                                              | a template re-declared under `@if (title(); as t)`; the default slot needs its presence (UF4001)                              | `title$={title$}`; the default slot needs its presence (UF4001)      | `<slot name="title" slot="title" />`; `item={item}`    |
| Default slot from a consumer, `<Field>…</Field>`           | children                                                                                   | default slot content                                                       | children                                                       | children                                                           | projected content                                                                                                             | projected content                                                    | default slot content                                   |
| Slot object, `{{ title: () => <h2 /> }}`                   | `title={<h2 />}`                                                                           | `<template #title>`                                                        | `{#snippet title()}`                                           | `title={<h2 />}`                                                   | `<ng-template ufFieldTitle>`, the directive in `imports`                                                                      | `title$={() => <h2 />}`                                              | `<Fragment slot="title">`                              |
| Scoped fill, `item: ({ item }) => …`                       | `renderItem={({ item }) => …}`                                                             | `<template #item="{ item }">`                                              | `{#snippet item({ item })}`                                    | `item={({ item }) => …}`                                           | `<ng-template ufFieldItem let-item="item">`                                                                                   | `item$={({ item }) => …}`                                            | `item={({ item }) => …}`                               |
| `defineModel("value", { default })`                        | `value?`, `onValueChange?`; local `useState` while `value === undefined`                   | `defineModel`                                                              | `value = $bindable(default)`                                   | `value?`, `onValueChange?`; local `createSignal`                   | `value = model<T>(default)`                                                                                                   | `value?`, `onValueChange$?`; local `useSignal`                       | `value` prop; the default when absent                  |
| A write, `value.value = x`                                 | local state while unbound; `onValueChange?.(x)`                                            | `value.value = x`                                                          | `value = x`                                                    | as React                                                           | `this.value.set(x)`                                                                                                           | as React, the callback awaited                                       | dropped with client code                               |
| Component `v-model:value={text.value}`                     | `value={text}` and `onValueChange` writing `text`                                          | `v-model:value="text"`                                                     | `bind:value={text}`                                            | `value={text()} onValueChange={setText}`                           | `[(value)]="text"`                                                                                                            | `value={text.value} onValueChange$={(v) => (text.value = v)}`        | `value={text}`; UF4001 (info): inert                   |
| Unbound model                                              | local state from `default`                                                                 | local mode                                                                 | the `$bindable` fallback                                       | local signal                                                       | `model()`'s default                                                                                                           | local signal                                                         | the default                                            |
| Several models                                             | a pair per model                                                                           | one `defineModel` each                                                     | one `$bindable` each                                           | a pair per model                                                   | one `model()` each                                                                                                            | a pair per model                                                     | one prop each                                          |
| `v-model` on a text-like `<input>` or `<textarea>`         | `value` and `onChange`                                                                     | `v-model`                                                                  | `bind:value`                                                   | `value` and `onInput`                                              | `[value]` and `(input)`                                                                                                       | `value` read in render, `onInput$`                                   | `value`; a `<textarea>`'s text; UF4001 (info): inert   |
| `v-model` on a `<select>`                                  | `value` and `onChange`                                                                     | `v-model`                                                                  | `bind:value`                                                   | `value` and `onChange`                                             | `[value]` and `(change)`                                                                                                      | `value` and `onChange$`                                              | `selected` on the option; UF4001 (info): inert         |
| `v-model` on a checkbox (boolean)                          | `checked` and `onChange`                                                                   | `v-model`                                                                  | `bind:checked`                                                 | `checked` and `onChange`                                           | `[checked]` and `(change)`                                                                                                    | `checked` and `onChange$`                                            | `checked`; UF4001 (info): inert                        |
| `v-model` on a radio                                       | `checked={x === v}` and `onChange`                                                         | `v-model`                                                                  | `bind:group`                                                   | as React                                                           | `[checked]` and `(change)`                                                                                                    | as React                                                             | `checked={x === v}`; UF4001 (info): inert              |
| `v-model` on checkboxes into an array, `<select multiple>` | helper `toggle`; `value` on a `<select multiple>`                                          | `v-model`                                                                  | `bind:group`, `bind:value`                                     | helpers `toggle`, `selectedValues`                                 | helpers `toggle`, `selectedValues`                                                                                            | helpers `toggle`, `selectedValues`                                   | `checked`, `selected`; UF4001 (info): inert            |
| Number and range inputs, `v-model_number`                  | helper `modelText`                                                                         | native                                                                     | helper `modelText`                                             | helper `modelText`                                                 | helper `modelText`                                                                                                            | helper `modelText`                                                   | the initial value; UF4001 (info): inert                |
| `v-model_trim`, `v-model_lazy`                             | helper `modelText`                                                                         | native                                                                     | helper `modelText`                                             | helper `modelText`                                                 | helper `modelText`                                                                                                            | helper `modelText`                                                   | the initial value; UF4001 (info): inert                |
| Fallthrough of `class` and `style` to the root             | `className`, `style` props merged (`cx`)                                                   | native                                                                     | `class`, `style` from `$props()`, merged                       | `splitProps`, merged                                               | `class` and `style` inputs merged into the root; the host clears both: helper `fallthrough`                                   | `class`, `style` props merged                                        | `class:list`, `style` merged                           |
| `defineOptions({ inheritAttrs: false })`                   | no `className` or `style` prop                                                             | `defineOptions`                                                            | no `class` or `style` prop                                     | no `class` or `style` prop                                         | no inputs; the host clears both                                                                                               | no `class` or `style` prop                                           | no `class` or `style` prop                             |
| `defineExpose({ focus })`                                  | `ref` prop, `useImperativeHandle`                                                          | `defineExpose`                                                             | `export function focus`                                        | `ref` prop called with `{ focus }`                                 | `focus` public, the rest protected                                                                                            | helper `exposeRef`: a `ref` signal prop holding `$` functions        | UF4001 (info)                                          |
| Component ref, `ref={field}`                               | `useRef`, `field.current?.focus()`                                                         | `useTemplateRef`                                                           | `bind:this`                                                    | `ref={(api) => …}`                                                 | `viewChild(Field)`                                                                                                            | `useSignal`, `await field.value?.focus()`                            | dropped                                                |
| Key, `InjectionKey<T> = Symbol("Tabs")`                    | `createContext<T \| undefined>(undefined)`                                                 | `Symbol("Tabs")` in a `<script lang="ts">` block                           | `Symbol("Tabs")` in `<script module>`                          | `createContext<T>()`                                               | `new InjectionToken<T>("Tabs")`                                                                                               | `createContextId<T>("Tabs")`                                         | dropped                                                |
| `provide(TabsKey, value)`                                  | `<TabsKey value={…}>` around the template                                                  | `provide`                                                                  | `setContext`                                                   | `<TabsKey.Provider value={…}>` around the template                 | `providers: [{ provide: TabsKey, useFactory }]`                                                                               | `useContextProvider`                                                 | UF4001 (warning)                                       |
| `inject(TabsKey, fallback)`                                | `use(TabsKey) ?? fallback`                                                                 | `inject`                                                                   | `hasContext(key) ? getContext(key) : fallback`                 | `useContext(TabsKey) ?? fallback`                                  | `inject(TabsKey, { optional: true, skipSelf: true }) ?? fallback`                                                             | `useContext(TabsKey, fallback)`                                      | the fallback                                           |
| A provided ref or computed                                 | helper `refObject`, a `.value` getter over the state; the provider rerenders its consumers | native                                                                     | helper `refObject`, a getter over `$state`                     | helper `refObject`, a getter over the signal                       | helper `refObject`, a getter over the signal                                                                                  | the signal itself                                                    | UF4001 (warning)                                       |
| Nested providers                                           | the inner one wins                                                                         | the inner one wins                                                         | the inner one wins                                             | the inner one wins                                                 | the inner element injector wins                                                                                               | the inner one wins                                                   | UF4001 (warning)                                       |
| `<component is={href ? "a" : "button"}>`                   | `const Tag = …; <Tag>`                                                                     | `<component :is>`                                                          | `<svelte:element this={…}>`                                    | `<Dynamic component={…}>`                                          | `@switch`, one branch per tag, the children in one `ng-template`: helper `@switch`                                            | `const Tag = …; <Tag>`                                               | `const Tag = …; <Tag>`                                 |
| `<component is={…}>` over components                       | `const Tag = cond ? A : B`                                                                 | `<component :is>`                                                          | `const C = $derived(…)`, `<C />`                               | `<Dynamic component={…}>`                                          | `@switch` over the components: helper `@switch`                                                                               | `const Tag = …`                                                      | `const Tag = …`                                        |
| Fragments, `<>…</>`                                        | as M1 (ADR-0036)                                                                           | as M1                                                                      | as M1                                                          | as M1                                                              | as M1                                                                                                                         | as M1                                                                | as M1                                                  |
| Signature props (§4.2)                                     | ADR-0034                                                                                   | ADR-0034                                                                   | ADR-0034                                                       | ADR-0034                                                           | ADR-0034                                                                                                                      | ADR-0034                                                             | ADR-0034                                               |
| `defineEmits`, element events and their options            | ADR-0047                                                                                   | ADR-0047                                                                   | ADR-0047                                                       | ADR-0047                                                           | ADR-0047                                                                                                                      | ADR-0047                                                             | ADR-0047                                               |
| State and derived values                                   | ADR-0046                                                                                   | ADR-0046                                                                   | ADR-0046                                                       | ADR-0046                                                           | ADR-0046                                                                                                                      | ADR-0046                                                             | ADR-0046                                               |
| Effects and lifecycle hooks                                | ADR-0048                                                                                   | ADR-0048                                                                   | ADR-0048                                                       | ADR-0048                                                           | ADR-0048                                                                                                                      | ADR-0048                                                             | ADR-0048                                               |
| Template refs on elements, `useId`                         | ADR-0049                                                                                   | ADR-0049                                                                   | ADR-0049                                                       | ADR-0049                                                           | ADR-0049                                                                                                                      | ADR-0049                                                             | ADR-0049                                               |
| Setup locals: functions, constants, `let`s                 | ADR-0045                                                                                   | ADR-0045                                                                   | ADR-0045                                                       | ADR-0045                                                           | ADR-0045                                                                                                                      | ADR-0045                                                             | ADR-0045                                               |
| Elements, attributes, `class`, `style`, spreads, SVG       | ADR-0037 to ADR-0040                                                                       | ADR-0037 to ADR-0040                                                       | ADR-0037 to ADR-0040                                           | ADR-0037 to ADR-0040                                               | ADR-0037 to ADR-0040                                                                                                          | ADR-0037 to ADR-0040                                                 | ADR-0037 to ADR-0040                                   |
| Conditionals, lists, JSX whitespace                        | ADR-0030, ADR-0036                                                                         | ADR-0030, ADR-0036                                                         | ADR-0030, ADR-0036                                             | ADR-0030, ADR-0036                                                 | ADR-0030, ADR-0036                                                                                                            | ADR-0030, ADR-0036                                                   | ADR-0030, ADR-0036                                     |
| `<Transition>`, `<Teleport>`, `innerHTML` (§4.3, later)    | M8                                                                                         | M8                                                                         | M8                                                             | M8                                                                 | M8                                                                                                                            | M8                                                                   | M8                                                     |

Event and model names follow ADR-0012: a Qwik callback ends in `$`, a Svelte event is lower case,
and Angular renames an output named like a DOM event (ADR-0056). A React scoped slot is
`render<Slot>` because of the lint above; Solid, Qwik and Astro keep the slot's name.
Where a cell names a helper, the helper is inline in the output (P7), and ADR-0055 declares it.

## Consequences

**Positive:**

- Every M3 construct has one source form and one declared form on each target, and the cells that
  differ from Vue are capabilities, not surprises (ADR-0033).
- The spikes put the hardest cells through every layer before any code: Qwik's and Astro's scoped
  slots, Angular's typed slots and bound fallthrough, React's lint on render props.
- Fallthrough is two attributes on every target, which Angular can carry.

**Negative:**

- React, Solid, Qwik and Astro consumers see scoped slots as props (`renderItem`, `item`,
  `item$`), and Angular consumers write an `ng-template` with a directive per named slot. Each is
  that framework's idiom, but the names differ.
- Six targets carry `modelText`, the one helper that reproduces Vue's text binding (focus, trim,
  lazy, number casting); its cases must cover each modifier on each of them.
- No `id`, `aria-*` or `data-*` falls through. A design system passes them as declared props.
- Default-slot presence and forwarding are errors on Angular and Qwik.

**Open:**

- The lanes confirm each cell with cases; a cell a case disproves is amended in this record before
  M3 accepts it, with the case as evidence.

## Alternatives considered

- **Render props named like the slot on React (`hint`).** `react/no-unstable-nested-components`
  fails L5; turning on its `allowAsProps` would judge the author's code (ADR-0042).
- **Qwik `<Slot name>` for named slots.** It takes no props and has no presence API, so scoped
  slots and presence would need a second form; a QRL render prop serves both.
- **Qwik render functions or `component$` props for scoped slots.** A plain function fails SSR
  serialisation (Q3). A `component$` passed as a prop works, but the parent must hoist each fill to
  module scope, away from the values it reads.
- **Astro `Astro.slots.render("item", [props])`.** Its arguments are lost behind `<Fragment slot>`,
  `<template slot>` works only by a runtime quirk with `set:html` (L5), and its arguments are
  `any[]`.
- **Every attribute falls through (Vue's rule).** Angular has no attribute spread, and the typed
  JSX already rejects undeclared attributes on a component.
- **The key in a `.ts` module (plan §4.2).** It would need a compiled `.ts` module (M5) or a
  registry helper keyed by symbol on four targets, which is not their idiom.
- **Angular `FormsModule` (`ngModel`) for `v-model`.** It brings a module and a directive for
  what `[value]` and `(input)` do; the spike's binding passed every layer.

## Evidence

The spikes are ADR-0053's (the same worktree, cases, commands and versions). Per cell:

- **Slots, default with fallback:** passes on every target: React `children ?? <span>No
details</span>`, Svelte `{#if children}`, Solid `children()`, Angular `<ng-content><span>No
details</span></ng-content>`, Qwik `<Slot>` (with ADR-0058's `q:template`), Astro `<slot>`.
- **Scoped slot `hint` with `{ length }`:**
  - React: `renderHint` passes L3 to L13; `hint` fails L5 with `react/no-unstable-nested-components
Do not define components during render. … If you want to allow component creation in props,
set allowAsProps option to true. (line 22, column 15)`.
  - Solid: `hint?: (props: { length: number }) => JSX.Element` under `<Show>`; passes, and re-renders
    `5 chars` after typing.
  - Svelte: `Snippet<[{ length: number }]>`; passes every layer.
  - Angular: a directive `ng-template[ufFieldHint]` with `static ngTemplateContextGuard` and
    `contentChild(FieldHint, { read: TemplateRef })` passes, with `<ng-content
select="[ufFieldHint]" />` so the template does not count as default-slot content. A plain
    `#hint` template types `let-length` as `any`: a misuse passes L3 and L4 silently.
  - Qwik: a render function prop fails SSR with Q3 (above); a `component$` prop and a
    `hint$?: QRL<(props) => JSXOutput>` pass, the QRL one written inline in the parent.
  - Astro: `<Fragment slot="hint">{(p) => …}</Fragment>` with `Astro.slots.render` fails L6
    (`Cannot destructure property 'length' of 'undefined' as it is undefined.`); `<template
slot>` fails L5 (`astro/no-set-html-directive`); the render prop passes L3 to L6.
- **Default-slot presence:** Angular has no API for whether `<ng-content>` received content, and
  Qwik exposes none (`_hasSlotProps` is internal). An Angular `<uf-outer>` that re-projects
  `<ng-content />` into an inner component always counts as content, so the inner fallback never
  shows, even when the outer received nothing.
- **Forwarding a named slot on Angular:** a template re-declared under `@if (title(); as t)` in the
  outer component reaches the inner one's `contentChild` in SSR, and the query updates in the
  browser when the `@if` toggles.
- **Models:** React's and Solid's `value` with `onValueChange`, Svelte's `$bindable`, Angular's
  `model()` with `[(value)]` on a signal, and Qwik's `value` with `onValueChange$` pass the bound
  and the unbound specs on every interactive target. A Qwik `bind:value` and a `value={signal.value}`
  write the `value` attribute on the client's first render (the optimizer makes them const props),
  failing L7; a value read in render does not. React's `value` attribute is ADR-0058's.
- **Fallthrough `class="wide"`:** React `className` merged after the spread, Solid `splitProps`,
  Svelte `class={["field", className]}`, Qwik `class={["field", className]}` and Astro
  `class:list` render `class="field wide"`. Svelte's and Astro's rest types must
  `Omit<HTMLAttributes<…>, keyof OwnProps>`, or an event named like a DOM event intersects with the
  DOM handler's type (`TS2322 Type '(value: number) => number' is not assignable to type
'((value: string) => void) & FormEventHandler<HTMLDivElement>'`). Angular's cell is ADR-0056's.
- **Events named like DOM events (`change`):** React, Vue, Svelte, Solid and Qwik pass
  `spike/hazard`: the native `change` from the child's `<input>` never reaches the consumer's
  handler. Angular's is ADR-0056's.
