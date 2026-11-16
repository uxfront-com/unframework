# ADR-0100: Transition

- **Status:** Accepted
- **Date:** 2026-11-16
- **Plan:** §4.3, §5.3, §6, §7.2 L5 to L12, §7.6, §9 M8; P4, P7; ADR-0033, ADR-0057, ADR-0085,
  ADR-0095, ADR-0098; amends ADR-0099 (when a directive's `unmounted` runs on an element that
  leaves with a transition), ADR-0042 (Vue's L5 turns off `vue/require-toggle-inside-transition`)
  and plan §7.6's "Settling" line (a capture waits for running animations)

## Context

Animated disclosure, like an accordion or a menu, needs enter and leave transitions. Plan §4.3
and §5.3 name `<Transition>`. Vue has one, whose contract is a set of CSS classes. The other
targets have none that runs that contract:

- React and Qwik have no transition primitive, and remove an element as soon as its condition
  turns false.
- Svelte's `transition:` runs its own CSS or ticks, never a class list.
- Solid's transitions are a package of their own, which no output imports (P7).
- Angular's `animate.enter` and `animate.leave` apply one class list, which can't express Vue's
  three phases.
- Astro renders once, on the server.

The harness switches motion off (plan §7.6): the determinism reset gives every transition and
animation no duration, so a capture never sees one mid-way. A spec that tests a transition's
timing has to opt into a real duration, and a capture has to wait for it to end.

## Decision

### The language

`Transition` is an authoring API, written only as a tag: `<Transition name="fade" appear>`. The
compiler recognises it by the binding its import declares. Any other use, a call or a read as a
value, is UF1002 at the identifier. The compiler checks how it is written:

- `name` is a string literal with no whitespace, `"v"` when it is left out, as in Vue. `appear` is
  the bare attribute, or `{true}` or `{false}` written as literals. Anything else is **UF3058**
  `transition-prop`, at the attribute.
- The child is exactly one intrinsic element, or one conditional whose every branch is one
  intrinsic element or nothing: `cond && <A/>`, a ternary, or an else-if chain. The element may hold
  anything. Text, two or more nodes, a component, a slot, `<component is>`, a fragment, a list, or
  a branch that is one of these, is **UF3057** `transition-child`. A component is no element here:
  React's compiled components take no `ref`, so the helper can't reach their DOM node.
- Another attribute is UF3035, `key` outside a list UF3014, `ref` UF3046, a directive UF3056 and a
  spread UF1002. A `<Transition>` anywhere in a list's body is UF1002: transitions on rows are
  `TransitionGroup`'s, which is left for later.
- `mode`, JavaScript hooks and `TransitionGroup` are left out.

The IR node is `{ kind: "Transition", name, appear?, children, span }`, whose invariants require
the child rule, a name with no whitespace, and a place outside a list's body. A component whose
whole render is a transition is a root of kind `other`, as a teleport is, so a parent's `class` or
`style` on it is UF3045.

### The semantic guarantee

Vue's CSS-class contract:

- **Enter.** Before the entering element is first painted, it carries `<name>-enter-from` and
  `<name>-enter-active`. Two frames later `-enter-from` goes and `-enter-to` comes. At the end, both
  others go.
- **Leave.** The same with `-leave-from`, `-leave-active` and `-leave-to`. The element stays in its
  place until the end, then it is removed.
- **The end** is the element's own `transitionend` or `animationend`, or its longest duration and
  delay, whichever comes first. With no duration, the element is settled by the end of its second
  frame.
- **A swap** runs the old branch's leave and the new branch's enter at once, so both are in the
  DOM until the leave ends. A swap transitions even when both branches are the same tag.
- **`appear`.** On a client mount, the first element runs the enter. Without `appear`, it doesn't.
- **Server HTML** is the settled state on every target: the element, with no class of the
  transition and no wrapper.
- **The holder.** When the component that holds the `<Transition>` unmounts, or a condition around
  the `<Transition>` turns false, the child goes at once, with no leave, as on Vue. Only a change of
  the transition's own child runs a leave.
- **Not guaranteed:**
  - Whether `appear`'s enter runs after hydration or resumption. Every target's hydrated DOM
    settles to the server's either way.
  - The order of the two elements during a swap.
  - How toggling back while a leave runs looks. Vue removes the leaving element and enters a new
    one, Svelte reverses the outro, and Angular keeps the old element leaving beside the new one. Either way the shown element ends settled, which
    `transitions/reverse` checks.
  - Whether a leaving element still updates. It is frozen on Vue, React, Svelte, Solid and Angular,
    and may update on Qwik.
  - A bound `class` on the element that changes during a transition, which may cut it short on the
    emulated targets.
  - `prefers-reduced-motion`, which no target consults, as Vue doesn't.
  - A duration over 4 seconds on Angular, which forces the removal after `MAX_ANIMATION_TIMEOUT`.
  - When a directive's `unmounted` runs, below.
  - Which rule applies when the child's own condition and a condition around the `<Transition>`
    turn false in the same update.
  - How long Svelte keeps a leaving element: it ends a phase by the element's duration, read as
    the phase starts, not by its `transitionend`.

### Directives on a leaving element

ADR-0099 said P7's leave transitions delay `unmounted` until the element leaves the DOM. That isn't
what Vue, the reference target, does: Vue queues a directive's `unmounted` when the element's
vnode unmounts, as its leave starts, and only the DOM removal waits for the leave. Solid and
Angular do the same, while Svelte, React and Qwik run it after the leave.

So this record amends
ADR-0099: `unmounted` runs once, at the start or at the end of the leave, and once the leave has
ended it has run on every target. `transitions/directive` checks that half.

### The lowering

| Target  | Cell                          | Lowering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue     | native                        | `<Transition name="fade">` around `v-if`, or `v-if`, `v-else-if` and `v-else`, with no `name` when it is `"v"`. Vue keys the branches itself. `appear` is `v-bind="{ appear: true }"`: Vue's server compiler wraps the child in `<template>` when it finds `appear` as an attribute or a `:appear` binding (`ssrTransformTransition`), which leaves the server HTML unsettled, and it reads no object binding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| React   | emulated, `Transition`        | `<Transition name="fade">{open ? <p key={0} …/> : null}</Transition>`, an inline component, with a key on each branch. A change of key keeps the old element, as it last rendered, beside the new one until its leave ends. It owns the classes in state, since React writes the whole `class` attribute when `className` changes, and sets state only in frame and event callbacks, or while it renders as its child changes. Each element renders through an inline `TransitionItem`, whose ref keeps the child's own, a template ref or a directive's. The server and the hydrating client see no class, through `useSyncExternalStore`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Svelte  | emulated, `enter` and `leave` | `{#if}`, `{:else if}` and `{:else}`, with `in:enter={"fade"} out:leave={"fade"}` on each element, local, so a parent's creation or destruction runs none, as on Vue. With `appear`, `in:enter\|global`, which runs as the element first mounts: Svelte's `mount` plays intros, and its hydration doesn't. The functions return a deferred config, which Svelte calls for every run, once the element is in the document and before it is painted. Each call stops what the element's other phase still runs, as when Svelte reverses a leave, adds `-from` and `-active`, swaps `-from` for `-to` two frames later, and reads the element's duration. The classes go at Svelte's `introend` or `outroend`, so both elements of a swap end in one frame.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Solid   | emulated, `Transition`        | `<Transition name="fade"><Show when={open()}>…</Show></Transition>`, an inline component. It resolves the child with `children()` and renders a signal of the elements it keeps: the shown one, and each one leaving until its leave ends. `insert` keeps a node it already holds. `<Show>` has already disposed the leaving branch, so it is frozen. The server renders the child as it is, and resolves it nowhere else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Angular | emulated, `Transition`        | `<ng-container [ufTransitionRegion]="(open) ? 0 : -1">` around the conditional, and `<p [ufTransition]="'fade'" [ufTransitionBranch]="0" #transition="ufTransition" (animate.leave)="transition.leave($event)">` on each element. The region's inline directive, `TransitionRegion`, is created with the transition and holds the branch shown, which Angular sets before it renders the conditional inside. The element's inline directive runs the enter after the render that created its element if its region had rendered before, or with `appear`, so an element that a condition around the transition shows again enters only with `appear`. Only an element with a branch reads its region: one of a transition without a conditional would find the region of a transition around it. `animate.leave`'s function form holds the element's removal until `animationComplete()`. Angular also runs that function when it removes or destroys a view around the element (`runLeaveAnimationsWithCallback` through `collectNestedViewAnimations`), so the directive runs the leave only when the region shows another branch than its element's, and completes at once otherwise. The region's binding is outside the conditional, where Angular's template check narrows no condition. |
| Qwik    | emulated, `transition`        | A signal of the branches the transition renders, `{fadeShown.value.includes(0) && <p ref={transition(fadeState, "fade", 0, false)} …/>}`, starting at the condition's value, so the server renders the settled child. A `document-ready` visible task tracks the branch shown: it runs the old element's leave and drops its branch at the leave's end, unless the branch is shown again first, which stops the leave. It adds a new branch to the signal and marks it entering, and the new element's ref runs its enter as Qwik creates it, so it carries `-enter-from` before it is painted. A mark no element took within two frames goes, since a condition around the transition hides it, so an element that condition shows again enters only with `appear`. The ref calls the element's own ref first, and does nothing on the server, where Qwik calls it too. Qwik serialises the transition's state, so what stops a running phase is in a module-level `WeakMap`.                                                                                                                                                                                                                                                                                                                 |
| Astro   | unsupported, UF4001 (info)    | Prints the child as it would without the `<Transition>`: the server-time branch, with no class.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Every emulated helper reads the end as Vue does: the longest of the computed transition and
animation durations, each with its delay, plus a millisecond, unless the element's own
`transitionend` or `animationend` comes first. Angular also completes a leave on any
`animationend` that reaches the element, a child's included, which no case tests.

### The harness

1. **Settling waits for animations.** Each settle round also waits until no CSS transition, CSS
   animation or Web Animation in the document runs (`document.getAnimations()`), for at most 2
   seconds. One still running then fails the settle: never a retry. This extends plan §7.6's
   "Settling" line, which an accepted ADR may do. It changes no capture of another case: the reset
   leaves none running.
2. **The reset stays.** In every capture a transition has no duration, and settles within two
   frames.
3. **A spec that tests timing opts in.** It appends a `<style>` to `document.head`, inside its own
   test, which gives its case's `-active` classes a real duration with `!important` (a class
   selector beats the reset's `*` among `!important` rules), and removes it in a `finally`. It reads
   the classes once a frame, or watches them with a `MutationObserver` attached before the action,
   since `view.user` returns only once the page has settled. The style is in `head`, so the
   after-test check doesn't see it. `@unframework.dev/testing` gains no public API.

### Vue's L5

`vue/require-toggle-inside-transition` is off (amending ADR-0042). It judges a `<Transition>`
whose child has no `v-if` or `v-show`: the author's `<Transition><p/></Transition>` without
`appear`, which never runs, and with `appear`, which the output binds as an object, so that the
server renders the settled child, and which the rule doesn't read.

## Consequences

**Positive:**

- `<Transition name appear>` compiles to the seven targets, and Astro renders the settled child.
- A capture never samples a transition mid-way, whatever duration a spec gives it.
- The cases are `transitions/enter`, `transitions/leave`, `transitions/appear`,
  `transitions/swap`, `transitions/directive`, `transitions/outer`, `transitions/reverse`, `transitions/nested`,
  `diagnostics/transition-child` and `diagnostics/transition-prop`.

**Negative:**

- `@unframework.dev/testing`'s settle changes for a design system's own tests too: a running
  animation that never ends fails a test within 2 seconds.
- Five targets carry an inline helper for every component that holds a `<Transition>`.

**Open:**

- `TransitionGroup`, and a `<Transition>` in a list's body.
- A component as a transition's child, once React's compiled components forward `ref`.

## Alternatives considered

- **Svelte's `transition:`.** It passes `direction: "both"`, and runs its own CSS, never Vue's
  classes.
- **Ending Svelte's classes at the element's `transitionend`.** Svelte removes a leaving element by
  its own clock, which races the event by a frame, so a swap's two elements ended in different
  frames from run to run.
- **`solid-transition-group`.** It is a package of its own, which no output imports (P7).
- **Angular's class form, `animate.enter="fade-enter"`.** It applies one class list, so it can't
  express the three phases.
- **Running `unmounted` after the leave on every target.** Vue, Solid and Angular would need a
  wrapper that holds the hook, and Vue's would read the transition's private leave callback.
