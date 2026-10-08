# @unframework/target-react

The React 19 target of the Unframework compiler: one function component in TSX per source
component, written as a React developer would write it (plan §6):

- the type declarations the props use, copied as written (exported as in the source), then
  `export default function Badge({ label, tone = "info" }: BadgeProps)`, or
  `function Plain(props: PlainProps)` with `props.label` kept. A prop that no expression reads is
  left out with its default, and a parameter nothing reads is `_props` (an object form's keeps a
  name that is `_` and more, and takes `_` before any other: `_props`, `__`): unused bindings
  fail L5.
- expressions as the source writes them, a ref's value read as React's (`count.value` is
  `count`); conditionals as ternary chains ending in `null` (never `&&`, which renders a `0`);
  lists as `.map((item, index) => <li key={…}>…)`, with the index only when something reads it;
  a root fragment as `<>…</>`.
- React's prop names (`className`, `htmlFor`, `tabIndex`, `strokeWidth`) and its rules for
  form controls (a `<textarea>`'s text becomes its `defaultValue`). Every boolean attribute the
  IR holds is one of React's boolean props, written bare or bound as it is. The attributes
  `@types/react` types as numbers are written as numbers (`tabIndex={0}`).
- an SVG `<title>` of several parts as one string, ``<title>{`${label} icon`}</title>``, branches
  and all: React's server renderer writes a title whose children are an array as an empty one. A
  part that may be nullish is written `part ?? ""`, so that it renders nothing as on the other
  targets, only where TypeScript reads its syntax as sometimes nullish: TS2869 and TS2871 reject
  the guard on `n + 1`, on `a ?? "x"` and on `a ?? null`, whose nullish fallback becomes `""`
  instead (`a ?? ""`). A `string` or `number` prop that is never absent needs no guard.
- `className="a b"` for a static class; any other class goes through `cx`, an inline helper
  printed after the component (`className={cx("badge", tone, { active })}`): the
  `class-binding` capability is emulated.
- `style={{ color: "red", marginTop: gap }}`, typed `as CSSProperties` (a type import from
  `react`) when it sets a custom property.
- a spread written out key by key (`title={attrs.title}`, through `?.` when the source may be
  absent), its `class` merged into the element's `cx`.

## The setup, events and listeners (M2)

The setup runs as React's hooks, in source order, after the props (`src/setup.ts`; ADR-0045 to
ADR-0049 record the decisions):

| Source                                                                                                          | React output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `const count = ref(initial)`                                                                                    | `const [count, setCount] = useState(initial)`, and `const countRef = useRef(count)` when client code writes it; no setter when nothing does                                                                                                                                                                                                                                                                                                                                                                                             |
| `count.value` in a template, a getter, an initial value                                                         | `count`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `count.value` in client code (handlers, functions, effects)                                                     | `countRef.current`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `count.value += step`                                                                                           | `countRef.current += step; setCount(countRef.current);` (a block where it stood alone)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `const total = computed(() => …)`                                                                               | `const total = useMemo(() => …, [every dependency])` where render code reads it (the template, a getter, a watch source, `watchEffect`), and `function currentTotal() {…}` over the mirrors where client code reads it                                                                                                                                                                                                                                                                                                                  |
| `const input = useTemplateRef<T>()`, `ref={input}`                                                              | `const input = useRef<T>(null)`, `ref={input}`, `input.current`; untyped, `T` is the element's interface (`HTMLInputElement`, `SVGCircleElement`); a `T` other than the element's interface (`HTMLElement` on a `<div>`) is set by a callback, `ref={(element) => { input.current = element; }}`                                                                                                                                                                                                                                        |
| `const id = useId()`                                                                                            | `` const id = `uf-id-${useId()}` ``                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `const label = …` reading component values                                                                      | `const [label] = useState(…)` (it evaluates once)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `const`/`function` capturing nothing                                                                            | module scope, as written                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `let timer: T`                                                                                                  | `const timer = useRef<T \| undefined>(undefined)`, `timer.current`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `function save() {…}`                                                                                           | as written; with a `current<Name>` variant where a template calls it and client code reads otherwise                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| a function passed as a value (`addEventListener("keydown", onKey)`, a timer's callback)                         | `const [onKey] = useState(() => (event: KeyboardEvent) => {…})`: one function for the instance's life                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `watch(source, cb, options)`                                                                                    | a `previous<Source>` ref, `const on<Source>Change = useEffectEvent(cb)` with its parameters typed from the sources, and `useEffect` over the source values that calls it when one changed (`Object.is`), returning `onCleanup`'s callbacks; where a pre watcher writes state, a post watcher waits for the write to render (its state is a dependency, and so is a count of its waits, which it raises so that React commits again where the state ends where it was) and keeps its cleanups in a ref for its next call and the unmount |
| `watchEffect(effect)`                                                                                           | `useEffectEvent` taking the values it reads, and `useEffect` over them; a value only a function it calls reads is passed as `_name`; where a pre watcher writes state, it waits for the write to render, as a post watcher does, and calls back only with values its last call did not have                                                                                                                                                                                                                                             |
| `onMounted(cb)`, `onUnmounted(cb)`                                                                              | `const onMount = useEffectEvent(cb); useEffect(() => { onMount(); }, [])`; `useEffect(() => () => onUnmount(), [])`, after every other effect, so every watcher's cleanup runs before it                                                                                                                                                                                                                                                                                                                                                |
| `await nextTick()`                                                                                              | `await nextTick()`, from `const nextTick = useNextTick()` (inline helper, after the state the component's effects write, passed as `() => Object.is(resultsRef.current, results)`): its render has the priority of the code that calls it, so it resolves in the task of the click or key that wrote, once its effects ran and nothing they wrote waits to render (else it asks for a render of its own and looks again); when the component unmounts too                                                                               |
| `defineEmits<{ change: [value: number] }>()`                                                                    | `export interface CounterEvents { onChange?: (value: number) => void }`, the parameter typed `CounterProps & CounterEvents`, emitted events destructured                                                                                                                                                                                                                                                                                                                                                                                |
| `emit("change", v)`                                                                                             | `onChange?.(v)` (`props.onChange?.(v)` in the object form)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| a prop or event read after `await`, in a timer, a cleanup, a function passed as a value or a native listener    | through a mirror synced in `useLayoutEffect`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `onKeydown={handle}`, `onClickCapture`                                                                          | `onKeyDown={handle}`, `onClickCapture` (React's names: `onDoubleClick` for `dblclick`)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `onClickOnce`                                                                                                   | a `useOnce()` guard first in the handler: once per element                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `onWheelPassive`                                                                                                | `onWheel` (React's root listener is passive)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `onChange` on a text field, a checkbox or a radio, `select`, `beforeinput`, `focusin`, a non-passive `wheel`, … | a native listener from the element's ref callback, declared once: `const [emailListeners] = useState(() => (element: Element \| null) => listen(element, "change", …))`, one `listen` call per event and phase (`listen` typed over `HTMLElementEventMap`); written in place only where a listener reads a list's row or a value its branch narrows                                                                                                                                                                                     |
| `onFocus` on an element with descendants                                                                        | `if (event.target !== event.currentTarget) return;` first                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `onFocus`, `onBlur` beside a native `focusin`, `focusout` on its path                                           | native too, so `focus` runs before `focusin` as in the DOM                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| a handler's `(event: KeyboardEvent)`                                                                            | React's `KeyboardEvent` from `react`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

A write's mirror makes every read in client code see it at once, in the same function, another
listener of the same event, a called function or after an `await`, whatever React has rendered;
render reads the state. A read a template's condition narrows for a handler written in its branch
(the analyser's `template` paths) is the rendered value, which TypeScript narrows there as in the
source; every other read keeps its mirror or live getter, whatever condition is around it, and
a narrowed path that React's spelling does not narrow (a live getter's call, a prop's mirror in a
closure) is asserted (`currentSelected()!.name`, `ownerRef.current!.name`). Writes
React Compiler 1.0 cannot lower (`x ??= y`, an update of a
variable a closure captures) are written out (`x = x ?? y`; `x += 1` where the update's value is
dropped, `(x += 1) - 1` where it is used). An item that reads a binding the source declares
later (a call of a `function` declared further down) follows that declaration: React Compiler
rejects the read before it; effects keep their source order, but for post watchers,
`watchEffect` and `onMounted` where a pre watcher writes state (after every pre watcher), and
`onUnmounted` (last). Listeners of one event on one element run in attribute order in one
handler: each one's code written out where it can stand among the others, an early return at its
top level as the negated condition around the rest (`if (tags.length !== 0) { … }`), and one that
is async or returns early otherwise as a local function the handler calls
(`const clickListener = async () => {…}; void clickListener();`), so every listener after it
starts in the dispatch. Local functions that refer to each other in a cycle (a listener that
removes itself through the helper it calls) are declared together in one `useState` initializer,
`const [{ close, onEscape }] = useState(() => { …; return { close, onEscape }; })`: React
Compiler rejects a read before its declaration, and no order of a cycle avoids one. A
conditional whose branches hold state a user can change (a control, a listener, a template ref)
and can render an element of one tag at their top (through fragments, nested conditionals and
lists) keys every branch, so React never reconciles one branch's element with another's: a single
root element takes `key={0}`, several roots or a list a keyed `<Fragment key={1}>`, and a nested
conditional that is a branch's only root keys its own branches under that branch's key
(`key="1.0"`); two keyed conditionals among one parent's children start their keys with their
position (`key="2-0"`).

Where the component's code holds what React Compiler 1.0 cannot compile yet (its `Todo` and
`Invariant` bail-outs: a value block or a `throw` inside a `try` block, `finally`, a default it
cannot reorder, a `for` head without a declaration or a test, `for await`, BigInt, a computed
key in a pattern, a type assertion on an assignment's target, and a few more, `src/bailouts.ts`),
the component opts out of it: its body starts with a comment naming the shape and
`"use no memo";`. React prints an emit as an optional call (`onSaved?.(id)`), so an emit inside a
`try` block is one.

The capabilities: `interactivity`, `event-capture`, `event-passive`, `conditional-event-control`
and `use-id` are native;
`event-once` (`useOnce`), `event-semantics` (`listen`) and `next-tick` (`useNextTick`) are
emulated with inline helpers, and `class-binding` with `cx`. Of composition's cells,
`model-array` (`toggle`), `model-modifiers` (`modelText`) and `reactive-context` (`refObject`)
are emulated, and the others native. Composition's cells (ADR-0055) are declared before React emits
composition: until M3's lane for React lands, `emit` reports UF1002 where a component first uses it,
and emits nothing for that component.

Every name the output introduces (`cx`, `setCount`, `countRef`, `CounterEvents`, `listen`,
`CSSProperties`, `_props`) is claimed around the source's own names, so none captures another.
The target reports nothing: what React cannot render as the other targets do is the analyser's
to reject (ADR-0033).

## Toolchain

The tests and tooling build, check and run React output through three entries:

- `@unframework/target-react/toolchain` (Node): the Vite configuration of browser and SSR
  projects (`@vitejs/plugin-react`), the framework compile check (L3: React Compiler 1.0 on
  Babel 7, where a bailout is a warning; a function that opts out with `"use no memo"` passes
  only where React Compiler still finds what it cannot compile there, a `Todo` or an
  `Invariant`, and an opt-out it would compile is a warning, `react-compiler/needless-opt-out`),
  the type check (L4: one TypeScript 7 run over all
  files, against `tests/toolchains/react/tsconfig.json`) and the lint (L5: oxlint with the
  shared baseline and its React rules, `tests/toolchains/react/output.oxlintrc.json`).
- `@unframework/target-react/toolchain/client` (browser): mounts with `createRoot` inside
  `act`, rerenders with new props through `root.render`, passes the test's listeners as event
  props (`onChange` for `change`), and runs a user's action inside `act`, with
  `IS_REACT_ACT_ENVIRONMENT` set only during its own `act` calls.
- `@unframework/target-react/toolchain/server` (Node): renders with `prerender` and returns
  the component's HTML only.

`test/toolchain.test.ts` pins each shape the opt-out covers: React Compiler bails out on it
without the directive, and passes L3 with it; and its neighbours, which it compiles, get none.
`test/events.test.ts` checks the event table against react-dom's registrations and
`@types/react`'s props; `test/setup.test.ts` pins the setup, events and listeners as the target
writes them, and `test/lint-probes.ts` (`M2_SHAPES`) holds the same shapes, which L3, L4 and L5
must accept; `test/behaviour.browser.test.ts` runs them in Chromium (StrictMode, at the root,
included). `test/toolchain.test.ts` also type-checks `listen` over every event the target may
listen to natively, and a `ref` of each element's interface (`src/elements.ts`, the authoring
types' `DomElementFor` over lib.dom) on every element of the vocabulary.
`test/attributes.test.ts` checks the attribute spellings and values against `@types/react` for
every attribute the IR can hold (the names its types lack are the IR's `UNDECLARED_ATTRIBUTES`,
which the analyser rejects), and pins the one gap left: SVG's `<title>`, which React types as
HTML's.
