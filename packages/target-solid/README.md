# @unframework/target-solid

The Solid 1.9 target of the Unframework compiler: one function component in TSX per source
component, written as a Solid developer would write it (plan §6).

```tsx
import { Show, createMemo, createSignal, mergeProps, untrack } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export default function Counter(rawProps: CounterProps & CounterEvents) {
  const props = mergeProps({ initial: 0, step: 1 } satisfies Partial<CounterProps>, rawProps);
  const [count, setCount] = createSignal(untrack(() => props.initial));
  const doubled = createMemo(() => count() * 2);

  function increment() {
    setCount(count() + props.step);
    props.onChange?.(count());
  }

  return (
    <div class="counter">
      <output>{count()}</output>
      <Show when={doubled() > 10}>
        <span>Big</span>
      </Show>
      <button type="button" onClick={increment}>
        +{props.step}
      </button>
    </div>
  );
}
```

- The type declarations the props use, copied as written (exported as in the source). Props
  are never destructured (`solid/no-destructure`): Solid's props object is reactive, and every
  read is `props.label`. Defaults go through `mergeProps`, typed `satisfies Partial<Props>` so
  that literal defaults keep their types; it applies a default when a prop is absent or
  `undefined`, and keeps `null`, as the other targets do. When a default holds an object or an
  array literal, the defaults are a `const defaults: Required<Pick<Props, "attrs">> = { … }` of
  their own instead: `satisfies` would keep the literal's own type, without the optional
  members it leaves out (`{ title: "t" }`) or with only the literals it lists (`["info"]` for
  `Tone[]`), and `mergeProps` would type the prop by both (`tones.includes(tone)` fails). A
  scalar's literal type is a member of its prop's, which `mergeProps` keeps. The object form
  keeps its own name (`card.title`). A prop no expression reads takes no default, and a props object nothing
  reads is `_props` (an object form's name that is `_` and more is kept): unused bindings fail
  L5.
- Expressions exactly as the source writes them, with each prop read through `props`.
  Conditionals are Solid's control flow, which test truthiness as the IR does (`0` renders
  nothing): `<Show when={c} fallback={…}>`, `<Show when={!c}>` when only the else branch
  renders (`<Show when={c}>` for `!c ? null : …`), and `<Switch>`/`<Match>` for a longer chain,
  an empty branch holding `{null}`.
- A branch that reads a binding its tests mention (those that hold or fail where it renders)
  and may narrow reads it through the accessor `<Show>`'s and `<Match>`'s callback receives
  (`src/narrowing.ts`): their children are no branch of their condition to TypeScript, so
  `props.user.name` there would fail L4. A test narrows a path it reads as a truthiness test, a
  side of an equality, `typeof`'s operand, `instanceof`'s left, `in`'s right or a call's argument,
  and the paths that path is read through, where the path's type may be a union or `null`/
  `undefined` (read from the source: an optional prop, a type argument or an annotation, an alias
  or an interface the module declares, a member's type, an array's `length`, an initial literal;
  a type it cannot read may be one). A branch whose tests narrow nothing it reads
  (`results.value.length > 0`, `total.value > 2`, a `number` or a `Task[]`) reads it as everywhere
  else: `<Show when={results().length > 0}>…{results()}…</Show>`. Where the branch's one test is exactly the path it reads through, the `when` is
  that test: `<Show when={props.user}>{(user) => <p>{user().name}</p>}</Show>`. Solid types the
  value `NonNullable<T>`, which keeps the falsy literals (`""`, `0`) a truthiness test removes, so
  where the props' types hold one (read from their text, conservatively) the `when` is
  `props.limit || undefined`, which TypeScript narrows as the test does. Otherwise the `when`
  builds, inside the source's own condition, an object of the paths the branch reads, read
  through the accessor:
  `<Show when={props.count !== undefined ? { count: props.count } : undefined}>{(narrowed) => <b>{narrowed().count.toFixed(1)}</b>}</Show>`.
  TypeScript narrows no call, so where that `when` reads a signal (a state's or a derived value's
  accessor, or an accessor of a branch around it), it reads each once, as the argument of an
  arrow it calls at once, whose parameter TypeScript narrows:
  `<Show when={((user) => (user !== null ? { user } : undefined))(user())}>`.
  Each path is the longest prefix of a read that the tests have read wherever the branch
  renders, every object on the way present: `res` of `res.value.t` when the test is `res.ok`,
  but only `box.inner` of `box.inner?.title` in the else of
  `box.inner && box.inner.title.length > 3`, which may not have read `box.inner.title`. The
  `when` reads it before the branch would, so it reads nothing the source might not, and the
  rest of the read stays as the source writes it (`inner?.title`). An else or a branch of a
  chain that does is a `<Match>` whose `when` is the source's chain up to it, failed tests
  leaving nothing (`typeof props.value === "string" ? undefined : props.value !== null ? { value: props.value } : undefined`),
  so TypeScript narrows by every failed test and `<Match>` evaluates it only where they failed;
  a branch that needs none stays a plain `<Match when>` or the fallback. A negated test's else
  (`!user ? A : B`) is `<Show when={props.user} fallback={A}>`. An accessor is named after its
  binding or last property (`value` for one no target can declare), or a free name where that
  would capture a name the output prints as it is, the object form's parameter, an import or
  helper, or another callback's around it; it takes a list item's, a state's or a derived
  value's own name only in a branch without a listener or a template ref. A handler in a branch
  that reads what its tests narrow is one call (UF3029), which runs while its element and so its
  branch are there: its arguments read through the accessor too
  (`<button onClick={() => greet(owner().name)}>`). Object-valued branches' accessors are `narrowed` (`narrowed_1` inside
  another). The branches are not keyed (ADR-0036, as M2 amends it): Solid calls the callback once
  while the `when` stays truthy, so the branch keeps its DOM, focus and state when the value
  changes, and the accessor reads the latest value. TypeScript narrows no call, so a branch whose
  expressions narrow a received path further (`user.nick ? user.nick.trim() : "none"`) is keyed
  instead, with the values themselves (`<Show keyed when={props.user}>{(user) => …}`), and
  re-creates its DOM when they change. Solid calls the callback untracked, so a branch that is
  one interpolation is a fragment (`{(user) => <>{user().name + props.label}</>}`), which Solid
  compiles to a memo. The rules are syntactic: a value taken where none was needed renders
  alike.
- Lists are `<For each={items}>{(item, index) => <li>…</li>}</For>`. `<For>` keys rows by the
  items themselves, so the source's `key` is not printed (M1 guarantees a list's content and
  order, not its DOM identity); the index is an accessor, `index()`. A parameter nothing reads
  is left out, the key not counting.
- HTML's attribute names as written (`class`, `for`, `tabindex`, `readonly`), which Solid's JSX
  takes; SVG's in their own case (`viewBox`, `stroke-width`). Every bindable boolean attribute
  is one Solid's compiler sets as a boolean, so none needs `bool:` (`test/attributes.test.ts`).
  An attribute Solid's types do not let an element take, although the authoring types do (SVG's
  presentation attributes on gradients, filter primitives and `<stop>`, `direction`, `overflow`
  and `visibility` on most elements, `edgeMode` on `<feGaussianBlur>`, `lengthAdjust` on
  `<textPath>`, `href` on `<mpath>`, `tabindex` on `<dialog>`), is an object spread, which Solid
  renders as written:
  `<stop offset="0" {...{ fill: props.colour }} />`. Alone on its element, or where the types
  forbid it, the object is typed `Record<string, unknown>`, as TypeScript checks it otherwise.
- `class="a b"` for static names, and `classList={{ active: props.active }}` for toggles
  beside them, a condition that may not be a boolean in `Boolean(…)`. A lone string part is the
  class itself (``class={`tone-${props.tone}`}``). Any other class goes through `cx`, an inline
  helper printed after the component (`class={cx("badge", props.tone, { active: props.active })}`):
  Solid's `class` takes one string, and a `classList` beside a dynamic `class` would lose its
  toggles when the class changes. The `class-binding` capability is emulated.
- `style={{ color: "red", "margin-top": props.gap, "--gap": props.size }}`, with kebab-case
  keys and number literals as strings (`"line-height": "1.5"`, which `solid/style-prop` asks
  for); a static style string becomes such an object too.
- A spread written out key by key (`title={props.attrs.title}`, through `?.` when the source
  may be absent), its `class` merged into the element's `cx`: Solid's own spread would let the
  later `class` win (ADR-0039).

Three rewrites keep the output what Solid's tools expect:

- an interpolated conditional whose branch prints as a bare name (a list's item, `undefined`, or
  a value a keyed callback received) is a `<Show>`, as `solid/prefer-show` asks:
  `{done ? title : "-"}` becomes `<Show when={done} fallback={"-"}>{title}</Show>`;
- Solid compiles static content into an HTML template, where the browser drops a line feed
  right after `<pre>`. A line feed that would start a `<pre>`'s template (text after only
  expressions, `<pre>{name}{"\n"}{street}</pre>`) is inserted instead, as `{["\n"]}`;
- Solid's server compiler escapes an expression's value, but writes the string literals it
  finds inside a conditional, a `+`, the right of `&&` or a child's template literal into the
  HTML as they are. Such a literal holding `<` or `&` (`"` or `&` in an attribute) is wrapped in
  `String(…)`, the same string, which it escapes: `{done ? String("<b>") : props.name}`.

## Setup, state and effects (ADR-0045, ADR-0046, ADR-0048)

The setup's items in source order (`src/setup.ts`), after `mergeProps`:

| Source                                        | Solid                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `const count = ref(initial)`                  | `const [count, setCount] = createSignal(untrack(() => props.initial))`; no setter when nothing writes it |
| `count.value`, `count.value += step`          | `count()`, `setCount(count() + props.step)`                                                              |
| `const total = computed(() => …)`             | `const total = createMemo(() => …)`, read `total()`                                                      |
| `` const label = `…${name}` `` (setup-once)   | ``const label = untrack(() => `…${props.name}`)``                                                        |
| `let timer`                                   | `let timer` as written                                                                                   |
| `function save() {…}`, `const save = () => …` | as written, with no `batch`                                                                              |
| `watch(source, cb, options)`                  | `createWatcher(source, cb, options)`, an inline helper                                                   |
| `watchEffect((onCleanup) => …)`               | `createWatchEffect([sources], (onCleanup) => …)`, an inline helper over the values it reads              |
| `onMounted(cb)`, `onUnmounted(cb)`            | `onMount(cb)`, `onMount(() => onCleanup(cb))`, before the first watcher                                  |
| `useTemplateRef<T>()`                         | `let field: T \| null = null`, set and emptied by the element's `ref` callback                           |
| `useId()`                                     | `` `uf-id-${createUniqueId()}` ``                                                                        |
| `await nextTick()`                            | `await nextTick()`, an inline helper resolving a promise                                                 |

- Signals apply a write at once: a read after a write sees it, after `await` too, and Solid
  updates the DOM and recomputes the memos that read it as the write is made. Client code is
  copied as written, with no `batch`: the watchers, not the writes, give the contract's timing.
  A `batch` the compiler adds would drop the pending updates of a run that throws, and could not
  reach past an `await`. So the template and the getters run on each state between two writes
  of one synchronous run, where Vue's run on its last state only: a template or a getter that
  throws on such a state (a list shrunk before its selected index moves), or a run that hides an
  element and shows it again (which Solid then creates anew, without its focus), is a declared
  difference (ADR-0048).
- The watcher rule (the `interactivity` capability, emulated; `src/helpers.ts`, ADR-0048). A
  watcher is a job of a scheduler, Vue's, printed after the component:
  - `createWatcher` tracks its source (each source of an array) with `createReaction`, which
    queues the watcher when a value it read is written and tracks nothing more until the flush;
  - the first write that queues a watcher queues the flush, one microtask, so the flush runs
    once the synchronous code that wrote has finished: the handler, the timer's callback, the
    continuation after an `await`, whatever blocks, guards, loops, `try`s and calls it holds;
  - the flush runs each queued watcher once, in the order they were queued, those that run before
    the DOM updates first, then those after it (`flush: "post"`), and again while a watcher's
    writes queue others, as Vue's pre and post queues do. Solid has updated the DOM at each write,
    so a watcher after the DOM updates sees what the earlier ones wrote;
  - a watcher reads its source again, tracking it again, and calls back where the value differs
    (`Object.is`, each value of an array) from its value at the last callback or at its creation,
    with that value as `previous` and a cleanup registrar whose cleanups run before its next
    callback and when the component is removed; a value written away and back calls nothing;
  - an immediate watcher calls back at once, during the setup (the server's too, as Vue's), with
    no previous value (`[]` for an array of sources);
  - `createWatchEffect` takes the props, state and derived values the effect reads, which UF2015
    keeps to its straight-line start (its own reads, then those of the functions it calls, but
    none in code it hands on to run later: a timer's, a `then`'s or `onCleanup`'s callback), runs
    the effect once the component has mounted, and again with the post watchers whenever one of
    them has been written, even back to its value, as Vue's runs again after a write of a ref it
    read;
  - each watcher's teardown is a cleanup of an `onMount` created where the watcher is, and none
    runs on the server.

  So a synchronous run of client code calls each watcher back once at most, whatever its shape,
  and writes separated by an `await` call it back once on each side, as on Vue. Writes made while
  Solid renders (an immediate watcher's during the setup) flush after the mount, where Vue
  flushes them before its mounted hooks. `nextTick` resolves a promise: its continuation runs
  after the flush the writes before it queued.

- What the setup evaluates once reads props and state in `untrack`, as `solid/reactivity` asks.
  So does a function that rule would report (`src/untracked.ts`), where it reads a prop, state or
  a derived value, or calls a local function that does (its own reads, and those of a
  synchronous array callback it calls): a promise continuation (`.then((step) => untrack(() => …))`,
  an async one `.then((n) => untrack(async () => …))`), an array method's callback the rule does
  not read as its caller's (an async one, a comparator, `reduce`'s with a first value:
  `ids.map((id) => untrack(async () => { … }))`), an arrow kept in a variable
  (`stop = () => untrack(() => { … })`), and an arrow passed to a function (a local one,
  `queueMicrotask`) from a function the rule does not track, a setup function or a native
  listener's `handleEvent`: `update((list) => untrack(() => [...list, draft()]))`. From a
  watcher's callback, a hook or an `on…` prop's handler the rule tracks such an arrow, and from
  anywhere a timer's, a listener's, an observer's and a `create…` call's callback, so those stay
  as written. Each runs outside any tracking scope, so `untrack` changes nothing but says so.
- An async `watchEffect` is the helper's callback as written, an `async` arrow: the rule reads a
  `create…` call's callback as called later, async or not, and its sources are listed, so what it
  reads after an `await` is no dependency, as on Vue.
- A read the source's TypeScript narrows keeps its narrowing (`src/asserted.ts`). The analyser
  marks each read of a ref's value or a prop that a condition shows present
  (`BindingReference.narrowed`), and Solid reads state and derived values through a call, which
  TypeScript never narrows, so such a read gets a non-null assertion:
  `if (selected.value) emit("select", selected.value)` is
  `if (selected()) props.onSelect?.(selected()!)`, and `if (!draft.value.email) return;` makes
  the read after it `draft().email!`. A destructured prop is `props.x`, a property TypeScript
  narrows in the function that tests it but not in a closure of it, where it gets one too
  (`props.owner!`). A read inside a narrowed branch's handler reads the branch's accessor instead
  (src/narrowing.ts), and an unmarked read is never asserted.
- `createWatcher`'s previous value is typed `T` (`T | undefined` on an immediate watcher, and a
  mutable tuple for an array of sources, which a callback may annotate): Solid's `on` types it
  `T | undefined` and runs its cleanups on every re-run, which the contract forbids. A
  callback's and an effect's return value is `unknown`: an async one's promise is ignored, as on
  Vue, and passes `no-misused-promises`. Only the helpers, signatures, options and timings an
  output uses are printed: where every watcher runs after the DOM updates, the scheduler keeps
  one queue and a call names no `flush`.
- `onUnmounted` hooks are written before the first watcher or `watchEffect`, in reverse order:
  Solid disposes a component's computations in the reverse of their creation (solid-js 1.9
  `cleanNode`), and each hook, as each watcher's teardown, is a cleanup of its own `onMount`, so
  every watcher's and effect's cleanup runs before the hooks, which run in source order, as on
  Vue.
- Constants and functions that capture nothing of the component move to module scope
  (`unicorn/consistent-function-scoping`).

## Events, refs and emits (ADR-0047, ADR-0049)

- A listener is Solid's event prop by its own spelling (`onClick`, `onKeyDown`, `onDblClick`,
  `src/listeners.ts`, a total table over the IR's DOM events, pinned against Solid's types).
  Solid's compiler delegates 22 events (`click`, `input`, `keydown`…) to one listener on the
  document, which walks the event's path from its target, so their order and
  `stopPropagation()` hold among them, and listens natively to every other event (`focus`,
  `blur`, `change`, `submit`), which keeps its own semantics. A listener with an option is a
  native one: `on:click={{ handleEvent, capture: true }}` (`once`, `passive`). A delegated
  listener would run after every native one, so where a component listens to a delegated event
  natively after its target (`once`, `passive`), its plain listeners of that event are native too
  (`on:click={save}`), and they all run in the DOM's order.
- Solid takes one listener of an event per element (`solid/jsx-no-duplicate-props`): an
  element's others of that event, and a listener Solid's props cannot type (`encrypted` off
  media elements, `click`'s `PointerEvent`), are added from its `ref` callback with
  `addEventListener`. Where an element listens to one event more than once in one phase
  (`onClick` and `onClickOnce`), its `ref` callback adds all of them, in attribute order, so they
  run in that order: Solid's compiler orders an element's `ref` and listener props by their
  attributes, in reverse.
- A template ref is a `let` the element's `ref` callback sets, and empties on cleanup, when the
  element's branch is removed: `let field: HTMLInputElement | null = null;` and
  `ref={(element) => { field = element; onCleanup(() => { field = null; }); }}`. Its value is
  `T | null`, as the source's is, so the source's own annotations (`let stored: T | null`)
  type-check.
- The component's events are props, typed by a generated interface beside its props type
  (`CounterProps & CounterEvents`, `onChange?: (value: number) => void`), called
  `props.onChange?.(value)`.

Every name the output introduces (`props`, `rawProps`, `_props`, `defaults`, `cx`, setters,
`createWatcher`, `createWatchEffect`, the scheduler's `queuedWatchers`, `queueWatcher` and
`flushQueued`, `nextTick`, `narrowed`, the events' interface, the `solid-js` imports) is
claimed around the source's own names, so none captures another. The target reports nothing:
what Solid cannot render as the other targets do is the analyser's to reject (ADR-0033).

| Capability                                     | Cell                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `interactivity`                                | emulated: `createWatcher` and `createWatchEffect` over a scheduler; signals, listeners and hooks are Solid's |
| `event-capture`, `event-once`, `event-passive` | native: `on:event={{ handleEvent, … }}`                                                                      |
| `event-semantics`                              | native: some events delegated, the others native                                                             |
| `use-id`                                       | native: `createUniqueId`                                                                                     |
| `next-tick`                                    | emulated: `nextTick`                                                                                         |
| `class-binding`                                | emulated: `cx`                                                                                               |
| `model-array`                                  | emulated: `toggle`, and `selectedValues` for a multiple select                                               |
| `model-modifiers`                              | emulated: `modelText`                                                                                        |
| `reactive-context`                             | emulated: `refObject`                                                                                        |
| everything else                                | native                                                                                                       |

Composition's cells (ADR-0055) are declared before Solid emits composition: until M3's lane for
Solid lands, `emit` reports UF1002 where a component first uses it, and emits nothing for that
component.

## Toolchain

The tests and tooling build, check and run Solid output through three entries:

- `@unframework/target-solid/toolchain` (Node): the Vite configuration of browser and SSR
  projects (`vite-plugin-solid`, with `ssr: true` for SSR and without solid-refresh), the
  framework compile check (L3: babel-preset-solid in `dom` and `ssr` modes, where a template a
  browser would parse differently is a warning), the type check (L4: one TypeScript 7 run over
  all files, against `tests/toolchains/solid/tsconfig.json`) and the lint (L5: oxlint with the
  shared baseline and eslint-plugin-solid as a JS plugin,
  `tests/toolchains/solid/output.oxlintrc.json`).
- `@unframework/target-solid/toolchain/client` (browser): mounts with `render`, its props a
  proxy with a signal per key, which `mergeProps` reads as reactive props, holding the values the
  test passed (never a store's proxies), and rerenders by replacing each prop, removing those
  left out.
- `@unframework/target-solid/toolchain/server` (Node): renders with `renderToStringAsync`.

`test/output.test.ts` runs L3, L4 and L5 over what the emitter writes for sources that reach
every shape above, and renders the rewritten ones on the server (`test/rewrites.browser.test.ts`
mounts them in Chromium, and `test/behaviour.browser.test.ts` runs the setup's: watchers before
and after the render, one callback per synchronous run of every shape (Vue's emits for the same
source, `Coalesced`), cleanups and the hooks after them, listeners and their options and order,
template refs, lifecycle hooks, branches narrowed on state). `test/setup.test.ts`
and `test/listeners.test.ts` pin the setup's and the listeners' shapes, and the event table
against Solid's types and compiler; `test/lint-probes.ts` holds the M1 and M2 shapes L5 must
accept. `test/attributes.test.ts` type-checks every binding the analyser
accepts, as the output writes it, against Solid's JSX types, and proves that each attribute the
output spreads is one those types reject (`src/attributes.ts`).
