# ADR-0099: Portable directives

- **Status:** Accepted
- **Date:** 2026-11-15
- **Plan:** §4.3, §5.3, §6, §7.2 L5 to L12 and L14, §9 M8; P2, P4, P7; ADR-0033, ADR-0048,
  ADR-0069, ADR-0070, ADR-0095, ADR-0098; amends ADR-0002 (`v-model` is the only built-in
  directive, and authors define their own)

## Context

A component library repeats small behaviours on its elements: a menu closes on a click outside
it, a dialog keeps the focus inside, a field takes the focus once it shows. ADR-0002 made `v-model`
the only directive and left "M8's portable directives, such as click-outside and focus-trap" for
later, so today an author writes each behaviour again in every component's `onMounted` and
`onUnmounted`, and `v-x` is UF1002. M10's overlays need more behaviours than two, so the language
needs a way to write one once and apply it anywhere.

Every target can run code on an element, but each does it differently:

- Vue has custom directives, and calls a directive's `updated` after every update of its
  component.
- Svelte has attachments (`{@attach}`), and actions, whose `update` treats an object as always
  changed.
- Solid has `use:`, which Solid 2 drops, and ref callbacks.
- Angular has attribute directives.
- React and Qwik have refs and effects, and no directive.
- Astro runs nothing in the page.

## Decision

### The language

A directive is a top-level `const` that `defineDirective` initialises, from the authoring API:

```ts
export const vFocusTrap = defineDirective<boolean>({
  mounted(el, value) {},
  updated(el, value, oldValue) {},
  unmounted(el) {},
});
```

- A `.uf.ts` module exports its directives, beside its composables or alone, and a component
  imports one by name. Each compiles to one module per target. A `.uf.tsx` module may declare its
  own, not exported, which every output that applies one declares. Two components of one source
  that apply it each declare it, so their outputs can't be joined into one module (ADR-0053), as
  with a constant both read: each such component goes in a file of its own.
- The name is `v` and an upper-case letter, in ASCII letters and digits. An element applies it as
  `v-` and the rest in kebab case: `vFocusTrap` is `v-focus-trap`. The names of Vue's own
  directives (`v-if`, `v-show`, `v-html`, …) are reserved: an attribute of one stays UF1002, and a
  directive named so is UF2037.
- `T`, the value's type, is required, and `E`, the element's, defaults to `HTMLElement`. The hooks
  are methods with unannotated parameters, at least one of them.
- The hooks run in the browser only, so they read their parameters, their own names, the globals
  client code reads (`CLIENT_GLOBALS`) and, in either module, the module's constants and value
  imports (ADR-0070). They never call the authoring API, and can't read a component's bindings.
  Per-element state lives on the element, or in a module constant such as a `WeakMap`.
- The value is `v-name={expression}` or `v-name="text"`. A value built in place (an object or
  array literal, a function written in place, a `new`) is UF3056, since it is a new value at
  every render on React and Vue and the same one on Svelte. A setup function by its name alone is
  a value too, as a listener names one, which the hooks call: `v-click-outside={close}`.
- Arguments and modifiers (`v-name:arg`, `v-name_mod`) are UF1002, and so is a directive among a
  spread's keys and, for now, a directive on an element in a list's body (below).

The diagnostics:

| Code   | Name                    | When                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UF2037 | `invalid-directive`     | `defineDirective` anywhere but as a top-level `const`'s value, a name that isn't `v` and a capital or is one of Vue's, no type argument, an argument that is no object of method hooks, an unknown or repeated hook, an annotated parameter, a non-exported directive in a `.uf.ts`, or a hook that reads what it may not |
| UF3055 | `unknown-directive`     | `v-name` where the module declares or imports no `vName`, or `vName` is a constant. A directive whose import failed (UF1202) reports nothing more                                                                                                                                                                         |
| UF3056 | `invalid-directive-use` | A directive on a component, `<Teleport>` or `<component is>`, without a value, or with a value built in place                                                                                                                                                                                                             |

A setup name, a prop, a model or a slot that shadows a directive an element applies is UF3024,
once per name, since Vue's `<script setup>` and Angular's class resolve a directive by its name and
React, Svelte and Qwik take a model or a slot as a prop. A directive whose value reads a name a
scoped slot's fill declares, such as its parameter, is UF1002, as in a list's body (below). A
`defineDirective` nested in a constant's value is UF2037. An import of a name a `.uf.ts` module
doesn't export is UF1202.

The IR gains a `Directive` attribute, `{ kind: "Directive", name, value, span }`, and a module's
`directives`, each with its hooks' code, the module's bindings they read and the types they name.
`ImportedName.kind` gains `"Directive"`, and `ModuleApi.directives` lists a `.uf.ts` module's by
name. A caller's output depends on nothing else of a directive: Qwik's typed list of elements reads
the element's type from the directive itself, `DirectiveElement<typeof vFocusTrap>`. The constants an in-file directive's hooks read are the bindings of
each component that applies it, so each output declares them as its own. `Target.emitDirective`
emits a `.uf.ts` module's directive, as `emitComposable` emits a composable.

### The semantic guarantee

- **Server.** No hook runs during SSR, and the server HTML holds nothing a hook writes.
- **`mounted`** runs once per element, after it is in the DOM, after the first mount or a
  hydration, with that render's value.
- **`updated`** runs after a render in which the value changed, `!Object.is(value, oldValue)`,
  with both, and never otherwise.
- **`unmounted`** runs once, after `mounted`, when the element leaves the DOM or its component
  unmounts. The element may already be detached (Alex's answer to this plan's first decision):
  this is Vue's own order, and Svelte and Angular remove the DOM before their teardowns run.
- **Order, Vue's.** Within one render, a descendant's hook runs before its ancestor's, and
  siblings' `mounted` in document order, whichever outputs the directives and the elements come
  from. For `unmounted`, only "descendant before ancestor". Every `unmounted` of a render runs
  before its `mounted`, so a branch that replaces another mounts after the other unmounts.
- **A hook's return value** is ignored, as Vue ignores it.
- **Not guaranteed:**
  - Whether a directive mounted during an event sees that event at `document`. Vue and Svelte
    flush during the dispatch, Solid renders synchronously from its handler.
  - A teleported element's place when `mounted` runs, on Qwik, which moves it after the mount.
  - The value's type at the call site: TypeScript doesn't type a dashed JSX attribute. Each
    output's own type check (L4) catches it where the target checks a directive's value.
  - React's development StrictMode runs `mounted`, `unmounted` and `mounted`, as `onMounted`'s.

### The lowering

| Target  | Cell                       | Lowering                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vue     | native                     | `<div v-focus-trap="open">`, an `ObjectDirective<E, T>` imported in `<script setup>`, or declared there for an in-file one. Its hooks read the value from the binding, `mounted(el, { value })`, and `updated` returns early on the same value. No `created`, which turns off the hydration attribute check, and no `getSSRProps`.                                                                                                   |
| React   | emulated, `useDirective`   | `const focusTrapRef = useDirective(vFocusTrap, () => open)` at the component's top level, and `ref={focusTrapRef}`, or a call in the element's own ref callback. The module exports the plain hooks, which run through `queueHook`. The calls are declared in a post-order of the elements.                                                                                                                                          |
| Svelte  | native                     | `<div {@attach vFocusTrap(() => open)}>`, a factory in `vFocusTrap.svelte.ts` whose attachment runs `mounted` untracked, an `$effect` that reads the value for `updated`, and returns its teardown for `unmounted`.                                                                                                                                                                                                                  |
| Solid   | emulated, `queueHook`      | `ref={vFocusTrap(() => open())}`, Solid 2's own form, a factory that registers `onMount`, an effect for `updated` and `onCleanup` while its element renders, composed into the element's one ref callback where it has one.                                                                                                                                                                                                          |
| Angular | emulated, `runDirective`   | `<div [vFocusTrap]="open()">`, a standalone `VFocusTrap` class in `v-focus-trap.ts`, selected by its input, whose `afterRenderEffect` passes the value to the inline `runDirective` and whose `DestroyRef` stops it.                                                                                                                                                                                                                 |
| Qwik    | emulated, `runDirective`   | A `ref` function that adds each element to a signal of the use's elements, and fills the element's template ref too where it has one, and a `document-ready` visible task per directive that tracks the elements and the value and calls the inline `runDirective` for each. The task's cleanup stops them, at the component's own unmount. The module exports the plain hooks, which the optimizer imports into the task's segment. |
| Astro   | unsupported, UF4001 (info) | Prints nothing for the attribute and imports nothing for it: a static page never runs a hook.                                                                                                                                                                                                                                                                                                                                        |

`queueHook` is one inline helper: hooks one turn queues run in a microtask, every `unmounted`
first, which `compareDocumentPosition` can't order against an attached element, then sorted
descendant before ancestor and then by `compareDocumentPosition`. An `unmounted` that follows its
own element's `mounted` in the turn, as StrictMode's `mounted`, `unmounted` and `mounted` do,
keeps its place among the rest, and one element's hooks keep the order they came in. The
codegen's `hook-queue` test runs the helper on a tree of elements. A detached subtree keeps its shape, so an
element removed with its descendants still sorts after them. Solid runs an element's ref before
its children's, Angular mixes the two orders, Qwik's is its own, and React's helper runs from
effects and microtasks, so each queues its hooks. Every output declares the helper, since none
imports another's (P7), but they share one queue, an array on `globalThis` under
`Symbol.for("unframework.directive-hooks@1")`, whose version changes with the entries' shape: a
directive module's hooks and a component's own sort
together, which the `directives/order` case checks with a child's root that applies a `.uf.ts`
module's directive. A hook that throws goes to `reportError`, and the rest of its turn still runs.
Svelte runs its attachments in Vue's order with no queue.

Some lowerings differ from the plan's starting points, each for a reason the work found:

- **React's ref callback only records its elements.** The plan's helper ran `unmounted` in the ref
  callback's cleanup. A ref callback written in place, as the element's merged callback is where
  a listener reads a narrowed value, is detached and attached again at every render, which would
  unmount and mount the directive each time. The callback adds the element it receives to the
  use's attached elements, its React 19 cleanup removes that one, and each schedules a sync in a
  microtask; a layout effect syncs after each render too. The sync compares the attached elements
  with those it mounted, so the same element keeps its directive, whatever React does with the
  callback, and each element of one use gets its own hooks. This settles the plan's R3. The
  microtask covers an element a child component renders in the component's slot content, whose
  callback runs without a render of the component. A second layout effect unmounts every element
  on the component's own unmount. An element's merged callback keeps each directive's cleanup.
- **One use follows every element it renders (PLAN v3).** A child may render slot content any
  number of times: once per row of a list, in either branch of a ternary, through a forward into
  another file's list. Vue, Svelte, Solid and Angular apply a directive per element already. React
  keeps the use's elements in a set, and Qwik's `ref` function adds each element to a signal of
  them, `collectElement`. On the server Qwik calls it with a `DomRef`, which the signal
  serialises, so a resumed page reads every element the server rendered. The visible task runs
  `runDirective` for each, which keeps its state per element. So how often a child renders the
  content doesn't matter, and the compiler predicts none of it. The `directives/repeated` case
  checks each count element by element.
- **A narrowed value is asserted where it is read outside its branch.** React's getter, Qwik's
  task and Svelte's attachment read the value after the conditional that narrowed it, so a read
  the condition narrows takes `!`, as Solid's and Angular's do (`assertedValue`). Qwik's task
  first checks that the element is still in the document.
- **The wrappers' own names never hide the hooks' reads.** A target's wrapper (Svelte's and
  Solid's factory, Angular's class) names its locals apart from every name a hook reads, `hooks_1`
  beside a module's `hooks` constant, and Vue names the binding's fields apart from a hook's
  locals, `{ value, oldValue: oldValue_1 }`. A hook's trailing parameters that its body never
  reads are left out, so no output declares an unused one.
- **A setup function as the value keeps one identity.** React reads it as the stable function it
  passes to client code (`useState(() => fn)`), Angular as an arrow member, and Qwik as a QRL, so
  `updated` doesn't run at every render.
- **Qwik's task tracks the value itself**, `track(() => open.value)`, rather than a
  `useComputed$` of it: one name fewer, and the same reads.
- **Svelte's factory takes `getValue`**, not `value`, which a hook's own parameter would shadow.
- **Angular and Qwik follow the element's place in the document.** Angular creates a component's
  projected content with the component, before a child puts it in the document, and keeps it
  while the child takes it out and back, with no lifecycle event either way. Qwik sets a signal
  ref when it creates the element, which may be before a slot projects it, and runs no task when
  a conditional removes it. So both call one inline helper, `runDirective`, with the element and
  the value, and it runs `mounted` once the output's one `MutationObserver` sees the element in
  the document, `updated` for a value that changed while it is, and `unmounted` once it leaves.
  The stop it returns ends the watch when the element's owner goes. `afterRenderEffect` and
  Qwik's visible task never run on the server, so neither needs a platform check. The
  `directives/slotted` case checks content a child shows and hides by its own state. On Qwik, a
  value in a conditional's branch may read what the condition narrows, `user.value!.name`, which
  can't be read once the condition fails, or a `typeof` narrowing, so the task reads it only
  while one of the elements is in the document. Until then it waits (`waitForDocument`) and runs
  again once one enters, through the list signal's `trigger()`. The task's context and its own
  `element` take names apart from the component's (`track_1`). The observer doesn't see into a
  shadow root.
- **Svelte's getter reads a branch's constant.** An attachment's getter is a closure, where
  TypeScript keeps no narrowing of a reassigned `$state`, and a `typeof` narrowing takes no `!`.
  So a directive's value in a branch is a `{@const markValue = user.name}` at the start of its
  innermost branch, whose type is the narrowed one, and the getter reads it:
  `{@attach vMark(() => markValue)}`. A constant is reactive, as the value is.

A directive on an element in a list's body is UF1002 for now (Alex's answer to this plan's second
decision). React gives a directive's state to its component, which renders the list once, so a row
would need a helper component of its own, and Qwik gives a row no signal of its own. The reason
is that one helper call can't give a value that differs per call, and a directive in a scoped
slot's fill whose value reads a name the fill declares is UF1002 for the same reason (Alex's
approval of PLAN v3). A scoped fill whose value reads only the component's own names compiles,
and so does slot content however often a child renders it, since every element gets its own
hooks. Both are read from the author's own component. UXF-715 holds the follow-up: a helper
component per row or fill on React and Qwik.

### Tooling

- The repository's lint config reads `v[A-Z]…` names in a `.uf.tsx` as used, since no JSX rule
  reads `v-focus-trap` as a read of `vFocusTrap`. The docs page tells authors to do the same.
- The L14 canary skips a source a target writes no file for: a `.uf.ts` module's directives on
  Astro have no map to corrupt.
- `@uxfront/unframework` exports `defineDirective` and the `Directive` and `DirectiveHooks` types.
  A probe that imported `reactive` now gets TS2724, a did-you-mean of `Directive`, for TS2305.

## Consequences

- `defineDirective` and `v-name={value}` compile to the seven targets, and Astro renders the
  element without them.
- `.uf.ts` modules may export directives beside composables, and a module with neither is UF2035.
- ADR-0002 is amended: `v-model` is the only built-in directive, and authors define their own.
- P7's leave transitions delay `unmounted`, which runs when the element leaves the DOM.
- P9's Solid 2 variant keeps the ref factory, with `onSettled` for `onMount`, and must do nothing
  on the server, where Solid 2 evaluates a ref.
- The cases are `directives/click-outside`, `directives/focus-trap`, `directives/updated-value`,
  `directives/shared`, `directives/order`, `directives/shapes`, `directives/slotted`,
  `directives/repeated`,
  `diagnostics/invalid-directive`,
  `diagnostics/unknown-directive` and `diagnostics/invalid-directive-use`.

## Alternatives considered

- **Two built-in directives, `v-click-outside` and `v-focus-trap`.** Smaller, but authors still
  couldn't write their own, and M10 needs more.
- **`beforeUnmount` for "before removal".** Svelte and Angular would need a removal hook no API
  gives, and Vue's nested order would turn parent first.
- **Solid's `use:`.** Solid 2 drops it, and it needs a global `JSX.Directives` augmentation.
- **Svelte actions.** An action's `update` treats an object as always changed.
- **A queue for each output.** No import is needed either way, but hooks from two outputs, a
  directive module's and a component's, would each sort only among their own, and run out of
  Vue's order.
