# ADR-0048: Effects and lifecycle hooks run in the browser, with Vue's timing

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §4.2 (Effects, Lifecycle), §4.5 (Watch timing, Effects are client-only), §6, §9 M2;
  P2, P4, P6, P7; R1, R5, R6; ADR-0007, ADR-0014, ADR-0015, ADR-0033, ADR-0045, ADR-0046;
  amends ADR-0042

## Context

Plan §4.2 gives the source Vue's effects:
`watch(source, (value, previous, onCleanup) => …, { immediate })`, `watchEffect`, `onMounted`,
`onUnmounted` and `nextTick`. Plan §4.5 promises that a watcher runs after the writes that triggered
it, at most once per batch, with the correct previous value, and that effects never run during the
server render. Plan §6 maps them to `useEffect`, `$effect`, `createEffect(on(…))`, `effect`,
`useTask$` and `track`, and lifecycle hooks to `useEffect(…, [])`, `onMount`, `afterNextRender` and
`useVisibleTask$`. Probes found that each framework times its effects differently:

- **Vue runs an immediate watcher's first callback during the server's setup**, and Angular's
  `effect` and Qwik's `useTask$` may run on the server too. Svelte runs `onDestroy` on the server.
  Vue's `watch` calls a shallow ref source back whenever its job runs, changed or not.
- **React lists an effect's dependencies statically**, where Vue tracks what each run reads. React's
  effects run after paint, re-run on a dependency that changed by `Object.is`, and run twice in
  StrictMode. React has no phase before the render: a watcher's write renders one commit later,
  and React commits nothing where every state a render would write ends where it was.
- **Solid runs an effect once per write outside `batch`**, and re-runs it when a batch ends where it
  began; it runs an effect's cleanups on every re-run, disposes a component's computations in the
  reverse of their creation, and drops the pending updates of a `batch` callback that throws. `on`'s
  callback types the previous value `S | undefined`, which fails L4 where a source passes it on as a
  `number`.
- **Angular renders a change in a later task** (its zoneless scheduler races a `setTimeout` against
  a frame), and destroys a component's outputs before its effects, so a cleanup that emits at
  destruction is dropped with NG0953.
- **Qwik's task cleanup runs before every re-run**, also one that finds its source unchanged; a
  visible task may run twice for one change; an async task queues a new change behind its pending
  run; its props proxy subscribes a reader only to the keys the props hold; and its lint rule
  `qwik/no-use-visible-task` rejects the only task that runs after the DOM renders.
- **Svelte's `$effect` treats a function an expression body returns as its teardown**, and Svelte
  tears a component's effects down in their creation order.

## Decision

- **The timing contract** (`semantics/watch-timing`, `semantics/effects-client-only`):
  - a watcher's callback runs after the writes that triggered it, before the interaction settles,
    and only when a source's value changed by `Object.is` (any element, for an array of sources);
  - `previous` is the source's value at the watcher's last callback, or at its creation;
    `undefined` on an immediate first run, `[]` for an array of sources;
  - its `onCleanup` callbacks run right before its next callback and at unmount, never on a re-run
    that does not call back; at unmount every watcher's and `watchEffect`'s cleanup runs before
    the `onUnmounted` hooks, which run in source order (`lifecycle/teardown-order`);
  - writes within one synchronous run of client code (a handler up to its first `await`, a
    continuation up to its next, a timer's callback) trigger it once, whatever blocks, guards,
    loops and calls the run holds. Writes separated by an `await`, or on Qwik by an awaited call of
    a local function (a QRL), may trigger it once or twice: code must not depend on whether they
    coalesce. `await nextTick()` always separates them;
  - the order of different watchers that one run triggers is not part of the contract: Vue orders
    them by trigger, Svelte and React by declaration. L9 records each step's events grouped by
    name (ADR-0050), and a spec asserts the order of emits from one synchronous run only;
  - DOM reads need `flush: "post"`. A watcher that is neither immediate nor post, and reads a
    template ref or a global that reads the rendered DOM (`readsDom`: `document` but its title,
    cookie, visibility and listeners, `window` whole or through its document, layout and scroll,
    `getComputedStyle`, `getSelection`), itself or through a function, before an `await nextTick()`
    that every path to the read passes, is UF2018 (`early-dom-read`), with a likely fix that adds
    `{ flush: "post" }`. A watcher that writes storage, the URL, the title or the clipboard needs
    nothing.
- **Effects are client-only.** No watcher (but Vue's immediate first callback), `watchEffect` or
  lifecycle hook runs during the server render, and no effect changes what the server renders.
  Because Vue runs an immediate watcher's first callback in the server's setup (and Angular and
  Qwik may), that callback, every function nested in it (an `onCleanup` callback included) and the
  local functions they call must be server-safe: no write of state, no template ref, none of the
  browser's globals (`BROWSER_GLOBALS`, every name lib.dom declares but the pure and runtime ones,
  ADR-0045) and no `SCHEDULING_GLOBALS`, no `await` and no `nextTick` (UF2013,
  `server-unsafe-effect`). Emits, `console`, `performance`, `crypto`, reads and a write of a setup
  `let` are safe. `immediate` with `flush: "post"` is UF2013 too, as no DOM exists during setup.
  Its help points at `onMounted` and a plain `watch`.
- **`watchEffect`** runs after the first render and again after any value it reads changes, after
  the DOM updates, on every target (on Vue, `watchPostEffect`). Its dependencies are static: every
  reactive read (a prop, a state, a derived value) lies in the straight-line start of its body,
  itself or through a function it calls (UF2015, `conditional-effect-read`, with `watch` and
  explicit sources as the help). The straight-line start runs up to the first `if`, loop,
  `switch`, `catch`, `return`, `throw` or `await`, with that `if`'s test, that `switch`'s,
  `return`'s or `throw`'s value and that loop's head (a `for…of`'s iterable, a `for`'s init and
  first test, a `while`'s test), into plain blocks and a `try` block up to the end of its first
  call (what follows may not run); it excludes the right side of `&&`, `||`, `??`, `||=`, `&&=`
  and `??=`, the branches of `?:`, what follows a `?.` in its chain, a destructuring default, and
  nested functions. A function the effect hands to a call that runs it later (a timer, `then`,
  `addEventListener`, an observer, `onCleanup`), written in place or held in a local `const` only
  such calls receive, is not the effect's: its references are marked `later` (ADR-0045), no
  target tracks them, and `summarizeTracked` leaves them out of every target's dependencies. So
  React's, Solid's and Qwik's lists of dependencies are exactly what Vue would track. The same
  rule holds for a watcher's getter, and a `computed` its source reaches, whose value may be an
  object, an array or unknown (a fresh object would re-run React's effect). A setup `let` or a
  template ref read while the effect runs is UF2010, as neither is a dependency; one read in what
  it hands on to run later (a timer's handle in `onCleanup`, an element in a frame) is accepted.
- **A `watchEffect` writes no state it reads** (UF2027, `self-triggering-effect`). Vue ignores an
  effect's own trigger while it runs; Svelte, Solid, Angular, Qwik and React run it again, without
  end. What counts is what runs while the effect runs: its code up to an `await`, the same part of
  the local functions it runs at once (`forEach(bump)` included), and the `computed` values it
  reads; what it hands on to run later and what follows an `await` do not. The help says to watch
  explicit sources with `watch`, whose callback is untracked.
- **Teardown reads no template ref and does not wait** (UF2026, `unsafe-teardown`). Vue empties a
  template ref before `onUnmounted` runs and React before an effect's cleanup, while Svelte,
  Angular and Qwik still hold the element. So an `onUnmounted` callback, an `onCleanup` callback,
  and the local functions they run (call, or pass to a call that runs them now or later) read no
  template ref; a listener they remove (`removeEventListener(type, onClick)`) does not run there,
  and may read one when its event fires. An `onUnmounted` callback is not `async` and calls no
  `async` local function (Vue drops an emit after unmount; the others deliver it), with a safe fix
  that removes an `async` that awaits nothing.
- **What the APIs take.** A source is a `state` or `derived` ref, a getter, or an array of them; a
  destructured prop, a ref's `.value`, the object form's `props.x`, a template ref, a constant, a
  setup `let` and `emit` are UF2020 (`unwatchable-source`), with safe fixes to `() => page` and to
  the ref itself. Every callback and getter is an arrow written in place; one given by name is
  UF2022, with a safe fix that wraps it. Options are an object literal of `immediate: true` and
  `flush: "post"`; `watchEffect` takes none or `{ flush: "post" }`. A default written out
  (`immediate: false`, `flush: "pre"`, `{}`) is UF1002 with a safe fix that removes it (ADR-0007:
  one form). `deep`, `once`, `flush: "sync"`, a non-literal and a watcher's stop handle are UF1002.
  `onCleanup` is only called, directly in the synchronous part of its callback, or passed whole to
  a local function held to the same rule: UF2013 in an immediate watcher, UF1002 elsewhere
  (Solid's `onCleanup` needs its owner). A callback and an effect may be `async`: on every target
  the part before its first `await` runs in the effect, tracked where the effect tracks, and the
  rest goes on by itself, its promise awaited by nothing.
- **`await nextTick()` is the one form** (UF2025, `non-canonical-call`). `nextTick` is an `Api`
  reference in client code, anywhere in it: a promise that resolves once the writes before it are
  in the DOM (`lifecycle/next-tick`, `events/async-handlers`). A callback given to it is UF2025, as
  React's, Angular's and Qwik's helpers take none; the safe fix makes the function `async`, awaits
  `nextTick()` and writes the callback's code after it, where the call is the last statement of a
  handler, an `onMounted` callback, a watcher's callback that is not immediate, or a local
  function nothing calls. `nextTick` used as a value (`.then(nextTick)`), or called through
  parentheses, an assertion or type arguments, is UF2025 too, the latter with a safe fix that
  calls it bare. `nextTick().then(…)` is accepted, and the invariants require every `Api`
  reference to be called with no argument.
- **`late-prop`** (a behavioural capability with no prerequisite, ADR-0047): a `computed`'s getter,
  a watch getter or a `watchEffect` that reads an optional prop, itself or through what it calls,
  requires it, at that read. Native on six targets. Qwik 2.0.0-beta.47's props proxy subscribes a
  `useComputed$` or a task only to the keys the props hold, so a derived value or a watcher misses
  an optional prop a parent adds after the mount, while the template follows it: unsupported, a
  UF4001 warning, and the component still compiles (`semantics/late-optional-prop`'s rerender test
  requires the capability). Astro renders a component's props anew on each render, so its cell is
  native.
- **Each target lowers them its own way:**

  | Source          | React                                          | Vue                 | Svelte                     | Solid                                    | Angular                                    | Qwik                                       |
  | --------------- | ---------------------------------------------- | ------------------- | -------------------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------ |
  | `watch`         | `useEffect` + previous ref + `useEffectEvent`  | `watch`             | `$effect.pre` + previous   | `createWatcher` (inline, a scheduler)    | `effect` in `ngOnInit`, through `computed` | `useTask$` + `track`, previous in a signal |
  | `flush: "post"` | the same, after the pre watchers' writes       | `{ flush: "post" }` | `$effect` + previous       | the same, flushed after the pre watchers | `afterRenderEffect` in `ngOnInit`          | `useVisibleTask$`                          |
  | `watchEffect`   | an effect over its static reads                | `watchPostEffect`   | `$effect`                  | `createWatchEffect([sources], …)`        | `afterRenderEffect` in the constructor     | `useVisibleTask$`, tracking its reads      |
  | `onMounted`     | `useEffect(() => { onMount(); }, [])`          | `onMounted`         | `onMount`                  | `onMount`                                | `afterNextRender` in the constructor       | `useVisibleTask$`                          |
  | `onUnmounted`   | `useEffect(() => () => onUnmount(), [])`, last | `onUnmounted`       | `onMount(() => () => {…})` | `onMount(() => onCleanup(fn))`, first    | `ngOnDestroy`, in the browser              | a visible task's `cleanup`, last           |
  | `nextTick`      | `useNextTick` (inline helper)                  | `nextTick`          | `tick`                     | `nextTick` (inline helper)               | `nextTick` (a private method)              | `nextTick` (inline helper)                 |

  Astro renders the initial state: it drops every watcher, effect and hook (`interactivity`
  unsupported), and `next-tick` is unsupported with it.

- **React** runs the author's callback in an effect event (`useEffectEvent`, React 19.2), which
  reads the latest props, so the effect lists only what triggers it. A source that is a state, a
  derived value or a prop is its own dependency; any other getter is a `useMemo` named after the
  callback's first parameter (`watchedSpan`). A ref holds the value at the last callback, so the
  mount run finds it equal and returns; an immediate watcher's ref starts `undefined` (`[]` for an
  array), so its mount run calls back. Unannotated parameters are typed from the sources
  (`typeof query`), since an effect event infers nothing. The callbacks an `onCleanup` registers are
  returned as the effect's cleanup, which React runs before the next run and at unmount, never on a
  skipped one. `watchEffect` is an effect over its tracked reads, which it passes to the effect
  event as parameters; a value only a function it calls reads is passed as `_unit`, since
  `exhaustive-effect-dependencies` rejects a dependency the effect does not read. A state write
  inside an effect event sets the mirror and passes it to the setter, React's "derived from a ref"
  exemption to `set-state-in-effect`.
  - **The settle gate.** Where a pre watcher writes state, each post watcher and `watchEffect`
    first checks that the write has rendered (`if (!Object.is(resultsRef.current, results))`):
    if not, it raises a count of its own (`setWaits(waits + 1); return;`), both among its
    dependencies, so React commits again even where the state ends where it was, and the effect
    runs once the write is in the DOM. A gated post watcher keeps its cleanups in a ref and runs
    them only before its next callback and at unmount; a gated `watchEffect` calls back only with
    values its last call did not have. Post watchers, `watchEffect`s and `onMounted` hooks then
    follow every pre watcher, in source order among themselves, and `onUnmounted` follows every
    other effect, since React tears passive effects down in declaration order.
  - **`useNextTick(settled)`**, called after the state the component's effects write and before
    every item that calls `nextTick`, asks for a render at the priority of the code that calls it
    and resolves, in a microtask after every effect of a commit that rendered the request has run,
    once `settled()` holds (`() => Object.is(resultsRef.current, results) && …` over the state its
    watchers, effects and hooks write); otherwise it renders again and looks again. In a click's or
    a key's handler the writes before it render in the event's task, so the continuation runs
    before the next event of that input, as on Vue. Pending requests resolve when the component
    unmounts, unless StrictMode mounts it again at once.
  - The shapes need no guard under StrictMode: a non-immediate watcher skips both mount runs, an
    immediate one runs, cleans up and runs again, and lifecycle hooks pair.
- **Vue** writes the source's calls (`watch`, `onMounted`, `onUnmounted`, `nextTick`), and
  `watchEffect` as `watchPostEffect`, which Vue never runs on the server. A destructured prop is
  watched through the getter the source must write; compiler-sfc refuses `watch(title, …)`. A
  `shallowRef` source (ADR-0046), alone or in an array, is read through a getter
  (`watch(() => selected.value, …)`), whose value Vue compares with `Object.is`.
- **Svelte** runs a watcher as `$effect.pre`, or `$effect` for `flush: "post"`, that reads only its
  sources and runs the callback in `untrack`: Svelte runs every effect of one synchronous run once,
  after it, and an `Object.is` test against the value at the last callback skips a run whose value
  did not change. A getter that is more than one read goes through a `$derived` named after the
  callback's parameter. The previous value starts as the sources' own, read in a function
  (`let previousName = untrack(() => watchedName);`), since a type query at the top of the script
  reads a state as its initial value narrows it; an array source's values are the mutable tuple Vue
  hands the callback (`[typeof a, typeof b]`). An immediate watcher has a first-run flag, so its
  first run calls back, with `previous` `undefined` (`[]` for an array). The callbacks an
  `onCleanup` registers run before the next callback and, through
  `onMount(() => () => cleanup?.())`, at unmount. `watchEffect` is `$effect`, whose returned
  teardown is `onCleanup`'s meaning; an async one starts an async function,
  `$effect(() => { void (async () => {…})(); })`. Lifecycle and effect callbacks always have a block
  body, and a value they return is dropped, since Svelte would call a returned function (a
  `watchEffect` with an `onCleanup` returns its teardown from every way out instead). `onUnmounted`
  is `onMount(() => () => {…})`, never `onDestroy`, which Svelte's server runs; one declared before
  a watcher or a `watchEffect` with a cleanup is printed after the last of them, so every cleanup
  runs before it. `nextTick()` is `tick()`.
- **Solid** coalesces through a scheduler, printed as inline helpers after the component, never
  through `batch` (client code is copied as written, ADR-0046). `createWatcher` tracks its sources
  with `createReaction`, which queues the watcher when a value it read is written; the first queued
  watcher queues one flush, a `queueMicrotask`, so the flush runs once the synchronous code that
  wrote has finished. The flush runs each queued watcher once, in the order they were queued, the
  pre watchers first and then the post ones, and again while a watcher's writes queue others, as
  Vue's pre and post queues do; Solid has updated the DOM at each write, so a post watcher sees
  what the pre watchers wrote. A watcher reads its sources again and calls back where a value
  differs by `Object.is` from the last callback's, with a registrar whose cleanups run before its
  next callback and in an `onMount`'s cleanup at unmount; an immediate watcher calls back at once,
  during the setup. Where every watcher has one timing the scheduler keeps one queue and a call
  names no `flush`. `createWatchEffect` takes the effect's tracked reads (UF2015, `later` reads
  left out), runs it once mounted and again with the post watchers whenever a source is written.
  Callbacks return `unknown`, so an async one passes `no-misused-promises`. So Solid's
  `interactivity` cell is emulated, its helper `createWatcher` (ADR-0047). `onUnmounted` is
  `onMount(() => onCleanup(fn))`, printed before the first watcher or `watchEffect` in reverse
  source order, since Solid disposes a component's computations in reverse creation order: the
  hooks then run last, in source order. `nextTick` resolves a promise, after the flush the writes
  before it queued.
- **Angular** creates each watcher's `effect` in `ngOnInit`, with the injector, where the inputs are
  set and the value at creation can be read once; no client code runs between the constructor and
  `ngOnInit`. The source is read through a `computed` (an array of sources as
  `computed(() => [a, b] satisfies [unknown, unknown], { equal })`, a mutable tuple compared by
  identity), whose version changes only when its value does, so the effect never runs for a value
  written back and Angular's own `onCleanup` runs exactly before the next callback. The callback
  gets the array itself, and the last one as `previous`, as Vue hands them. The first run finds the
  value at creation and returns; an immediate watcher calls back at once, in the browser only
  (`isPlatformBrowser`). The callback runs in `untracked`, an async one as
  `untracked(async () => …)`. A post watcher is an `afterRenderEffect`; `watchEffect` is an
  `afterRenderEffect((onCleanup) => …)`, an async one starting `void (async () => {…})()` inside it,
  and `onMounted` an `afterNextRender`, both in the constructor. Callbacks the class runs return no
  value. At destruction Angular stops each `output()` before it destroys the component's effects, so
  a watcher or a `watchEffect` with an `onCleanup` keeps its reference, and `ngOnDestroy` destroys
  them first, in source order, then runs every `onUnmounted` callback in the browser, one whose body
  returns in a function of its own. `nextTick()` is a private method,
  `await Promise.resolve(); this.appRef.tick();`: it renders the pending change in a microtask, as
  Vue does, and resolves after it, so the continuation runs in the event's task.
- **Qwik** runs a watcher as `useTask$(…, { deferUpdates: false })`, which tracks each source
  (`track(ref)`, `track(() => prop)`, or a `useComputed$` for a getter), keeps the value at its last
  callback in a signal, and calls back only on a change by `Object.is`, so its creation run never
  does; an array source is a mutable tuple
  (`const values: [typeof a.value, typeof b.value] = [track(a), track(b)]`). An immediate watcher's
  first run always calls back. `onCleanup` collects into a `noSerialize` list that the next callback
  empties first, and that a visible task's `cleanup` empties at unmount, since Qwik's own task
  cleanup also runs before a re-run that finds the source unchanged. A post watcher, `watchEffect`
  and `onMounted` are `useVisibleTask$(…, { strategy: "document-ready" })`, which runs after the DOM
  renders, in the browser only; `watchEffect` tracks its static reads first, keeps the values it
  last ran for and runs only when one changed (Qwik may run a visible task twice for one change),
  with its own cleanup list. An async callback or effect keeps the task synchronous up to its first
  `await` (its tracks and `onCleanup` there) and floats the rest, so a new change runs again at once
  rather than behind a pending run. Tasks keep their source order (a declaration they capture moves
  up), and run their calls of local functions in place. `onUnmounted` registers a visible task's
  `cleanup`, printed after every other task, so every cleanup runs before it. No `isServer` guard is
  needed: a non-immediate watcher's creation run never calls back, and an immediate one's first
  callback is server-safe. `nextTick` resolves after a macrotask, by which time the render its
  writes scheduled in a microtask has run.
- **Outside the contract** (each on the semantics page):
  - `await nextTick()` resumes in the event's task on Vue, Svelte, Solid and Angular, and on React
    after a click's or a key's handler; on Qwik, and on React after a watcher's, a hook's, a
    timer's or a continuation's writes, it resumes in a later task, so the next event of the same
    input (a `keypress` after its `keydown`) may run first. Act on the event that ends the gesture,
    or prevent the key's default;
  - writes in consecutive tasks with no render between them may call a watcher once on React,
    Angular and Qwik, whose renders are scheduled tasks; `await nextTick()` between them separates
    them. `view.clock` never makes them (ADR-0050);
  - on Solid, a template or a getter that throws on a state between two writes of one synchronous
    run, and a run that hides an element and shows it again (ADR-0046);
  - `nextTick()` on Qwik after a render that yields, past about 15 ms;
  - an emit after the component is removed.
- **Parent and child order** (plan §7.8) needs child components: M3 decides it, with its cases.
- **Amendment to ADR-0042.** `qwik/no-use-visible-task` is off: `onMounted`, `onUnmounted`,
  `watchEffect` and post watchers run after the DOM renders, in the browser only, which only a
  visible task does (`useTask$` runs before the render, and on the server). The rule judges whether
  the author's effect should wait for the DOM, and the source's `onMounted` already says it does.
  The target passes `strategy: "document-ready"`, so the task runs once the document is ready,
  never on its element's visibility.
- **Amendment to ADR-0042.** `svelte/prefer-writable-derived` is off: it judges the author's
  choice of `watchEffect` over `computed`, which the target prints as the author's `$effect`. A
  writable `$derived` would change what the server renders, since an effect runs in the browser
  only and a derived value on the server too.

From `effects/watch-cleanup`, an immediate watcher over a getter, with a cleanup:

```text
Source   watch(() => channel.value.toLowerCase(), (name, previous, onCleanup) => {…}, { immediate: true });
React    const watchedName = useMemo(() => channel.toLowerCase(), [channel]);
         const previousName = useRef<typeof watchedName | undefined>(undefined);
         const onNameChange = useEffectEvent((name, previous, onCleanup) => {…});
         useEffect(() => { … onNameChange(watchedName, previous, …); return () => {…}; }, [watchedName]);
Svelte   const watchedName = $derived(channel.toLowerCase());   let previousName = untrack(() => watchedName);
         $effect.pre(() => {…});
Solid    createWatcher(() => channel().toLowerCase(), (name, previous, onCleanup) => {…}, { immediate: true });
Angular  const currentName = computed(() => this.channel().toLowerCase());
         this.nameWatcher = effect((onCleanup) => { const name = currentName();
           if (!isPlatformBrowser(this.platformId)) return; untracked(() => {…}); }, { injector: this.injector });
Qwik     const nameSource = useComputed$(() => channel.value.toLowerCase());
         useTask$(({ track }) => { const name = track(nameSource); … }, { deferUpdates: false });
```

## Consequences

**Positive:**

- A watcher's callback, previous value and cleanup run at the same points on six targets, for every
  shape of synchronous run, and the server renders the same initial state on seven, checked by L6
  and L9 on every `effects/*` and `lifecycle/*` case.
- The diagnostics turn each timing hazard into a source rule (UF2013, UF2015, UF2018, UF2025,
  UF2026, UF2027) that holds for every target, rather than a difference found on one, and each is
  narrowed to the divergence it exists for: what an effect hands on, a read after
  `await nextTick()`, storage and the URL are accepted.
- `watchEffect`'s static dependencies keep React's, Solid's and Qwik's lists exact, without a
  runtime.

**Negative:**

- Outputs carry more than a hand-written component would: React's effect events, previous refs,
  settle gates and `useNextTick`, Svelte's flags and stoppers, Solid's scheduler, Angular's
  `ngOnInit` effects and `ngOnDestroy`, Qwik's previous signals, value gates and cleanup lists.
- Authors cannot use `deep`, `once`, `flush: "sync"`, a stop handle or `nextTick`'s callback, nor
  read a reactive value under a condition in `watchEffect`, nor write there what it reads.
- Declared limits, outside the corpus: on Svelte, Solid and Qwik a write of `-0` over `0` calls no
  watcher back where Vue's does (ADR-0046); Qwik's resumed page does not run an immediate watcher's
  first callback in the browser, so it runs on the server only (M8, L12); a Qwik watch callback
  that returns a value fails L4; a Qwik `computed` or watcher misses an optional prop a parent adds
  after the mount (`late-prop`). On Solid, writes an immediate watcher makes during the setup flush
  after the mount, where Vue flushes them before its mounted hooks.

**Open:**

- M3: parent and child order of lifecycle hooks, and effects across composition.
- M8: hydration (L12), and resumption on Qwik.
- Qwik's `late-prop` cell turns native once Qwik subscribes a reader to an absent key: the package's
  behaviour test fails then.

## Alternatives considered

- **Solid: `createEffect(on(…))` with a first-run skip** (plan §6). `on` types the previous value
  `S | undefined` (L4), and the effect runs, with its cleanups, when a batch ends where it began.
- **Solid: one `createEffect` per watcher, with `batch` around the writes** (the first and second
  builds), and `createComputed` for pre watchers. A lexical `batch` misses a run that crosses an
  `await`, a guard or a loop, needed a planner with a capability for the shapes it could not hold
  (`run-across-blocks`), and drops the pending updates of a callback that throws; a scheduler is
  exact for every shape, and both are deleted.
- **Angular: create watchers in the constructor**, or inside `afterNextRender`. The constructor
  cannot read an input's value at creation; inside `afterNextRender`, a watcher misses what
  `onMounted` writes.
- **Angular: register `onUnmounted` with `DestroyRef` inside `afterNextRender`.** Angular stops the
  outputs before those callbacks run, so an emit at unmount is dropped with NG0953.
- **Angular: `nextTick` from `afterNextRender`** (the first build). It resolves after Angular's
  scheduled render, a later task, so the next event of the same key ran first.
- **React: resolve `nextTick` after a transition render** (the first fix). A transition renders
  after every urgent update, which a key's next event is: the continuation lost the race that Vue
  wins.
- **Qwik: `useTask$` with an `isServer` guard for `onMounted`, or `useOn("qvisible")`.** A task runs
  before the render, and `qvisible` runs on visibility, not when the DOM is ready.
- **Qwik: write a signal during render to follow a late prop.** It is not how a Qwik developer
  writes it (G2); `late-prop` declares the difference instead.
- **Vue: `watchEffect` as itself.** Vue runs it before the render and on the server; the other
  targets cannot, so it runs post everywhere.
- **React: a dependency list compared by hand in the effect.** It runs a dead comparison on every
  render; parameters keep the list exactly what the effect reads.
- **Let effects run on the server where a framework does.** The server render would differ by
  target.

## Evidence

- `packages/analyzer/test/rules.test.ts`: "reports what an immediate watcher's callback may not do,
  itself or through a function", "reports `flush: "post"` on an immediate watcher, and an
  `onCleanup` called late", "accepts an immediate watcher that emits, reads and logs", "reports a
  `watchEffect`'s reactive read under a condition, itself or through a function", "accepts the head
  of the statement that ends the straight-line start: an `if`'s test, a `switch`'s, `return`'s or
  `throw`'s value", "reports what follows that head: an `if`'s branches, a `switch`'s cases, a
  `return`'s condition and dead code", "accepts a loop's head and the straight-line start of a plain
  block and a `try` block", "reports a read in a `try` block after a call that may throw, but the
  call's own arguments", "reports what a loop's head and a `try` block's start leave conditional:
  the body, the update, a `catch`, and what follows", "accepts reads in what the effect hands on to
  run later, written in place or held in a `const`", "reports a read in a function the effect runs
  at once, or calls, or after an `await`", "reports a read a chain's `?.` short-circuits, a logical
  assignment's right side and a default", "reports the same in a watcher's getter, or a reached
  `computed`, whose value may be an object", "accepts reads in the straight-line start of the body",
  "reports a watcher that reads the DOM before it updates, once, with the likely fix", "reports
  `window`'s scroll and layout, `getComputedStyle` and a query, itself or through a function",
  "accepts a watcher that writes storage, the URL, the title or the clipboard before the DOM
  updates", "accepts what a watcher reads after `await nextTick()`, itself or through a function",
  "reports what a watcher reads before `await nextTick()`, under the condition of one, or after
  another `await`", "accepts a post watcher, `watchEffect`, a hook and a handler", "reports what
  nothing can watch, with the safe fixes for a prop and a ref's value", "accepts a setup `let` or a
  template ref read in what `watchEffect` hands on to run later", "reports a setup `let`
  `watchEffect` reads while it runs, with the cleanup's spelling in the help" and "reports a setup
  `let` or a template ref read in a template, a getter, an initial value, a watched getter or
  `watchEffect`". `packages/analyzer/test/setup.test.ts`: "reports what a watcher does not support
  yet: its stop handle and its other options" and "reports a watcher's default options written out,
  with a safe fix that removes them (UF1002)".
- `packages/analyzer/test/client-rules.test.ts`: UF2025 "reports a callback, and awaits it where
  the function can become async (safe)", "offers no fix where the function's callers or its
  position would change", "reports `nextTick` used as a value, at the reference, without a fix",
  "reports a call through parentheses, an assertion or type arguments, and calls it bare (safe)"
  and "accepts `await nextTick()`, and `nextTick()` used as a promise"; UF2026 "reports a template
  ref read at unmount and in a cleanup, itself or through a function", "reports an async
  `onUnmounted` callback, with a fix where it awaits nothing (safe)", "accepts a listener removed at
  teardown that reads a template ref when it runs", "reports a function teardown runs later, or
  through a function it calls" and "accepts an element kept from the callback that set it up, and
  a ref read at mount"; UF2027 "reports a write of what the effect reads: itself, through a
  function or a `computed`, by `++`", "accepts a write in a function the effect hands to a timer or
  a promise, or after an `await`", "accepts a write in a function the effect hands on by name: a
  local `const` or a setup function", "marks `later` the reads in what client code hands on to run
  later, and no other", "reports a write the effect makes while it runs: before an `await`, in a
  callback run at once, or through a function" and "accepts an effect that writes only what it does
  not read, and `watch`". `packages/ir/test/ir.test.ts` "leaves the references marked `later` out
  of what code tracks".
- `packages/codegen/test/capabilities.test.ts` "derives late-prop where a derived value or a
  watcher reads an optional prop"; `packages/target-qwik/test/setup.test.ts` "declares a derived
  value or a watcher that reads an optional prop unsupported (late-prop)";
  `packages/target-qwik/test/behaviour.browser.test.ts` "follows an optional prop the parent passes
  from the mount, `undefined` at first" and "does not follow, in a computed or a task, a prop key
  the parent adds later".
- Vue 3.5.43: `packages/target-vue/test/setup.test.ts` renders on the server: "runs an immediate
  watcher's first callback, and no other watcher or effect", "runs no lifecycle hook, so no timer
  starts" and "renders the state that setup gives, whatever the effects and hooks would write".
  `packages/target-vue/test/behaviour.browser.test.ts`: "runs an immediate watcher during setup, and
  `watchEffect` once the component mounted", "runs each watcher once for two writes in one handler,
  with the previous value at its last run", "runs a cleanup right before its watcher's next
  callback, and at unmount", "skips a watcher whose source did not change, and fires an array source
  for any element", "reads the updated DOM in a post watcher", "runs `onMounted` once the DOM is in
  the document, and `onUnmounted` once removed", "calls a watcher of such a state alone back only
  when its value changed" and "calls an array watcher over such a state back only when a value
  changed" (both fail without the getter); `packages/target-vue/test/emit.test.ts` "reads a
  shallowRef source through a getter, alone or among an array watcher's";
  `packages/target-vue/test/framework-compile.test.ts` "refuses a destructured prop passed whole to
  watch(), where the output writes a getter".
- React 19.3.0: `packages/target-react/test/setup.test.ts` "lowers watchers to effects over their
  sources, with previous values and cleanups", "runs watchEffect as an effect over what it reads",
  "passes watchEffect's effect event the values only a called function reads, under names that say
  its body leaves them", "declares template refs and setup lets as refs, ids with the uf-id- prefix,
  and lifecycle hooks as effects", "awaits nextTick through the useNextTick helper, called before
  the setup's hooks", "declares nextTick before the effect events that await it", "runs a post
  watcher after the pre watchers, once what they wrote has rendered", "runs post watchers and
  watchEffect once what pre watchers wrote has rendered, with their cleanups kept for their next
  call or the unmount, before onUnmounted" and "calls a waiting watchEffect only with values its
  last call did not have, and keeps onMounted among the post effects in source order";
  `packages/target-react/test/behaviour.browser.test.ts` "runs a watcher once per handler, with
  previous values and cleanups, and not for a value written back", "runs onMounted with its element
  in the document, and onUnmounted when it goes", "resolves nextTick once React has rendered and the
  watchers have run", "runs a post watcher once the DOM shows what a pre watcher wrote, declared
  before it or not", and, outside `act`, "resolves nextTick once the writes before it, and those of
  the watchers they run, render", "runs post watchers and watchEffect once what pre watchers wrote
  has rendered, and each cleanup only before its next run", "runs post watchers and watchEffect, and
  resumes after nextTick, when a pre watcher's writes end where they were", "runs post watchers and
  watchEffect when a pre watcher's writes end where they were, with no nextTick to wait", "resumes
  after nextTick when a watcher's writes end where they were, with no effect waiting", "resumes
  after nextTick in the task of the key that wrote, before the key's next event" and "resolves
  nextTick when its component unmounts with the writes before it"; under StrictMode, rendered at the
  root, "keeps an onMounted timer running, and stops it at unmount", "leaves an immediate watcher
  joined, and runs its cleanup on a change and at unmount", "runs the cleanups of a watcher and a
  watchEffect that wait for a pre watcher's writes, as many times as their callbacks" and "runs a
  watcher once per change"; `packages/target-react/test/lint.test.ts` "rejects $what ($rule)" on "a
  state write in an effect, with a value no ref holds" and "an effect that lists values it does not
  read".
- Svelte 5.57.1: `packages/target-svelte/test/emit.test.ts` "emits the %s shape as
  test/fixtures/%s.svelte" (`Pager.svelte`, `Ticker.svelte`, `WatchEdges.svelte`,
  `Closing.svelte`), "starts an immediate array watcher's previous value empty", "never queries a
  source's type at the top of the script", "types a watcher's array source as a mutable tuple,
  never as const", "returns an effect's teardown from every way out of it" and "drops the value an
  effect or a synchronous onMounted returns"; `packages/target-svelte/test/toolchain.test.ts`
  "passes L3, L4 and L5 on what the target emits for each shape";
  `packages/target-svelte/test/behaviour.browser.test.ts` "calls back once per run with the previous
  value, and cleans up before the next call", "calls an immediate array watcher with [] first, and
  an async callback after its await", "tracks what an async watchEffect reads before its await, and
  cleans up before each run", "runs every cleanup before an onUnmounted hook declared before its
  watcher, as Vue does" and "runs effects and hooks after mount, cleans up before each run and at
  unmount"; `packages/target-svelte/test/lint.test.ts` "accepts $what", on "a watchEffect that
  writes one state" (it fails with `svelte/prefer-writable-derived` on).
- Solid 1.9.15: `packages/target-solid/test/setup.test.ts` "prints one source watched lazily with a
  helper of its own, over the scheduler", "runs post watchers after the others, and takes the option
  where both timings are", "keeps one queue where every watcher runs after the DOM updates, and
  takes no option", "prints the signatures an output uses: immediate, and an array of sources",
  "runs a watchEffect once mounted, and again after the DOM updates whenever a source is written",
  "lowers watchEffect over what it reads, and the lifecycle hooks to onMount and onCleanup",
  "registers the onUnmounted hooks before the first watcher, in reverse, so they run last and in
  order" and "prints the nextTick helper under the API's own name";
  `packages/target-solid/test/emit.test.ts` "emulates watchers, nextTick and class bindings with the
  helpers it prints, the rest natively"; `packages/target-solid/test/behaviour.browser.test.ts`
  "runs a watcher once per synchronous run of writes, only on a change, with its previous value",
  "coalesces each synchronous run where it runs, and runs a post watcher after a pre watcher's
  render", "coalesces a run past an await, a try, a guard and a local arrow's calls, and tears down
  in Vue's order", "calls a watcher back once per synchronous run of every shape, as Vue does" and
  "runs lifecycle hooks in the browser, empties a template ref with its element, and coalesces
  between awaits"; `packages/target-solid/test/lint.test.ts` "rejects $what ($rule)" on "a getter
  passed to a helper not named as a primitive (`create…`)" and "an async tracked scope (an async
  `watchEffect` as `createEffect(async …)`)". With `on`, a callback that passes `previous` on as a
  `number` fails L4 with TS2345, a probe's finding.
- Angular 22.2.1: `packages/target-angular/test/setup.test.ts` "watches a state through a
  `computed`, skipping the effect's first run", "watches a `computed` or an input as it is, and runs
  an immediate one in the browser", "compares an array of sources by element, and destroys a watcher
  with a cleanup first", "runs `watchEffect` and post watchers after the render, `onMounted` after
  the first", "renders the pending change in a microtask for `nextTick()`, and resolves after it",
  "runs an async watch callback untracked, its promise left to run", "runs an async `watchEffect`
  inside the effect, so its reads before `await` track", "hands the callback the values as a mutable
  tuple, annotated or not, never `readonly`", "types an immediate watcher's first previous values as
  Vue does, each or `undefined`" and "return none, and an `onUnmounted` that returns ends itself,
  not `ngOnDestroy`"; `packages/target-angular/test/effects.browser.test.ts` "runs once per handler,
  only on a change, with the previous value", "runs its cleanup right before its next callback,
  never for a value written back", "runs an immediate getter at setup, and its cleanup before the
  next and at unmount", "reads the updated DOM with `flush: "post"`", "changes in the browser what
  the server rendered: a watcher fed by `onMounted`", "runs after the render and after each change
  of what it reads, its cleanup first", "runs `onUnmounted` when the component goes: the timer
  stops", "resolves `nextTick()` once the DOM has updated, the ref empty once its element goes",
  "resumes in the task that rendered, before the next event of the same key", "runs an async watch
  callback and an async `watchEffect` past their `await`", "hands the callback its values and the
  previous ones as mutable tuples, annotated or not" and "run as the source's, and every
  `onUnmounted` runs whatever an earlier one returned";
  `packages/target-angular/test/render.test.ts` "renders the state before `onMounted` and the
  watcher it feeds" and "runs no immediate watcher, `watchEffect` or `onUnmounted` there".
- Before Angular's `ngOnDestroy` destroyed the watchers, `effects/watch-cleanup`'s last cleanup was
  dropped with "NG0953: Unexpected emit for destroyed `OutputRef`", a probe's finding.
- Qwik 2.0.0-beta.47, eslint-plugin-qwik 2.0.0-beta.47: `packages/target-qwik/test/setup.test.ts`
  "watches a ref in a task with the previous value in a signal", "tracks a getter through
  useComputed$, an array source as a tuple, and a prop as a read", "calls an immediate watcher back
  on its first run, and keeps onCleanup for its next callback", "runs post watchers, watchEffect and
  the lifecycle hooks in visible tasks", "waits a task in nextTick, and reads a ref in a conditional
  through rendered()", "keeps hooks and watchers in source order, moving up what they read that is
  declared later", "lets an async watcher's and watchEffect's body go on by itself, so a change
  reruns them at once" and "registers onUnmounted's task after every other, so the cleanups run
  before the hook"; `packages/target-qwik/test/behaviour.browser.test.ts` "calls back once per
  handler, with the previous value, and cleans up before the next callback", "runs onMounted once
  the DOM is in the document, and watchEffect after it and on changes", "reads the DOM after
  nextTick, and an empty ref once its element is gone", "runs hooks in source order, reading a
  computed declared after them", "drops an async watcher's run that a new change overtakes, at
  once" and "runs a watchEffect once per change, and every cleanup before onUnmounted";
  `packages/target-qwik/test/lint.test.ts` "accepts the shapes M2 emits (ADR-0045 to ADR-0049)".
  Before the rule was turned off, the shapes `MessageList`, `UnreadBadge`, `SectionHeading` and
  `AutoRefresh` failed only `qwik/no-use-visible-task`.
- The corpus cases `effects/watch-previous`, `effects/watch-immediate`, `effects/watch-cleanup`,
  `effects/watch-sources`, `effects/watch-effect`, `effects/watch-identity`, `effects/flush-post`,
  `effects/pre-and-post`, `effects/async-callbacks`, `effects/async-overlap`,
  `effects/async-watchers`, `effects/async-loop`, `effects/persistence-and-fetch`,
  `lifecycle/mounted-dom`, `lifecycle/unmount-timers`, `lifecycle/next-tick`,
  `lifecycle/teardown-order`, `lifecycle/document-listener`, `lifecycle/click-outside`,
  `semantics/watch-timing`, `semantics/effects-client-only`, `semantics/derived-from-props`,
  `semantics/late-optional-prop`, `semantics/helper-order` and `events/async-handlers` are green at
  every live layer on all seven targets (`semantics/late-optional-prop`'s rerender test skipped on
  Qwik by `late-prop`). `semantics/effects-client-only`'s and `lifecycle/mounted-dom`'s server
  renders (L6) show the state before `onMounted` on all seven, and `effects/watch-immediate` renders
  the same heading on the server on all seven, though Vue runs its immediate first callback there:
  the callback only emits.
