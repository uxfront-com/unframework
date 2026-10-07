# ADR-0047: Element listeners keep the DOM's semantics, and a component's events are named tuples

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §4.2 (Events), §4.3, §4.5 (Emit), §6, §9 M2; G2, G7, P2, P3, P4, P6, P7; R1, R5,
  R6; ADR-0007, ADR-0012, ADR-0015, ADR-0017, ADR-0031, ADR-0045; amends ADR-0033 and ADR-0042

## Context

Plan §9 puts element events with options, inline handlers and keys, and `defineEmits`, in M2.
ADR-0017 (Proposed) gives the source Vue's event names, `onClick`, `onKeydown`, with Vue's option
suffixes `Capture`, `Once` and `Passive`, and ADR-0012 (Proposed) maps a component's event `change`
to each target's convention: `onChange` on React and Solid, `defineEmits` on Vue, `onchange` on
Svelte, `output()` on Angular, `onChange$` on Qwik, and nothing on Astro. Both records stay
Proposed: their confirmation is the user's. This record decides what M2 built on them.

Probes against the installed frameworks found that the same listener does not mean the same thing
everywhere:

- **React's synthetic events differ from the DOM's.** `onChange` on a text field fires on every key,
  not when the value is committed, and on a checkbox or a radio it rides on the `click`, so it runs
  before `input` and for a prevented click; `onFocus` and `onBlur` ride on `focusin` and `focusout`
  and fire for a descendant's focus; React's root listens to `wheel`, `touchstart` and `touchmove`
  passively; react-dom synthesises `onBeforeInput` and `onSelect` from other events; and it has no
  prop for `focusin`, `command` and a few more. Its synthetic event lacks members the DOM's has
  (`isComposing`, `composedPath`, `stopImmediatePropagation`, `offsetX`), and a DOM event type on a
  React listener's parameter fails L4 (TS2322).
- **Options have no common spelling.** React has `Capture` props and no `once`; Solid delegates 22
  events to the document, where a native listener runs before them; Svelte has `onclickcapture`
  but no attribute for `once` or `passive`, makes `touchstart` passive, and runs the handlers it
  delegated below an element inside that element's own `on` listener; Angular's template has no
  option at all, and a directive listens when its element is created, before the template's own
  listeners; Qwik's loader dispatches from the document.
- **Qwik runs a handler once its code has loaded.** On a listener's first run that is after the
  dispatch, so `preventDefault()` in its `$` code comes too late; `event.currentTarget` is the
  document, and the element is the handler's second argument. Its loader queues a `$` handler that
  follows another handler's promise.
- **Angular prevents the default when a listener returns `false`**, and a template statement's last
  expression is the listener's value. It delivers one value per `output()`.
- **Svelte's compiler warns** (which fails L3) on a click or key handler a keyboard user cannot
  reach.

## Decision

- **Listener names are Vue's** (ADR-0017): `on` + the event + at most one option suffix (`onClick`,
  `onKeydown`, `onDblclick`, `onClickCapture`, `onClickOnce`, `onWheelPassive`). The IR holds the
  DOM's name (`EventAttribute { event: "click", capture?, once?, passive?, handler }`). A name is a
  listener when `on` is followed by a capital or by a known event. React's and lower-case spellings
  are UF3004, with a safe rename (`onKeyDown` → `onKeydown`, `onDoubleClick` → `onDblclick`,
  `onclick` → `onClick`). An unknown event, a window-only event (`hashchange`), an event HTML knows
  outside the vocabulary (`selectionchange`, with its reason), two options, and `Passive` on
  anything but `wheel`, `touchstart` and `touchmove` are UF3006. A second listener of one event and
  option on an element is UF3007. A spread's `onX` key stays UF1002 (fallthrough, M3).
- **The vocabulary is data** (`packages/ir/src/events.ts`): `DOM_EVENTS`, 96 events: Vue's JSX
  `Events` without `dragexit` (no browser fires it), and `<dialog>`'s `cancel`, `close` and
  `command`, each with the interface lib.dom dispatches it with; `WINDOW_EVENTS`;
  `UNSUPPORTED_EVENTS`, each with its reason; `PASSIVE_EVENTS`; and `PORTABLE_EVENT_MEMBERS`, for
  each interface the members both the DOM's event and React's synthetic event carry, with
  `PORTABLE_EVENT_INTERFACES`, the interface both dispatch each event with (React gives a `click` a
  mouse event and an `input` a plain event). `submitter` is portable: react-dom 19.3 copies it.
- **A handler is a local function's name or an arrow** (UF3029, `invalid-handler`): `onClick={save}`
  or `onClick={(event) => …}`, with either body, `async` allowed. A call, a conditional, a member, a
  function expression, a string and `emit` itself are UF3029. A handler that reads a list's
  variable, or a value a condition outside it narrows, is an arrow whose body is one call of a local
  function or of `emit`, with template-subset arguments (`() => remove(item.id)`,
  `(event) => pick(item, event)`), which Angular writes as a template statement. Writing the
  narrowed value is no read: `{open.value && <button onClick={() => (open.value = false)}>}` needs
  no narrowing, while a compound assignment, an update and a member's write read it. A handler's
  return value is discarded on every target.
- **The event parameter.** An inline handler's one parameter, and the first parameter of a
  function a listener names, is the event, marked in the IR with its DOM interface
  (`Parameter.event`): its annotation, or the nearest interface every event it receives extends.
  So is a parameter a handler passes its event to (`(event) => pick(item, event)`). An annotation
  may be a union of event interfaces (`event: MouseEvent | KeyboardEvent`, on a function a click
  and a key share): `Parameter.event` is then the nearest interface its members share (`UIEvent`),
  and the IR keeps the annotation as written. A function a listener names whose first parameter is
  not an event, or whose annotation holds no interface the event extends, is UF3029. Code uses the
  event only as `event.<member>`, recorded as an `Event` reference, for a member of
  `PORTABLE_EVENT_MEMBERS` that every event the parameter receives has (read, or called for
  `preventDefault`, `stopPropagation` and `getModifierState`), or passes it whole to a local
  function's event parameter. Anything else (`event.isComposing`, a computed member, a destructured
  or stored event) is UF3032 (`event-parameter-use`).
- **`preventDefault()` and `stopPropagation()` run while the event is dispatched** (UF3033,
  `deferred-event-control`). A control after an `await`, or in a function the handler hands on (a
  timer's callback, a promise's continuation), is UF3033: by then the browser has acted on the
  event, on every target. Every other control runs in place, under whatever test or `switch` case it
  is in, beside other statements or after a guard clause (a WAI-ARIA key handler's
  `switch (event.key)`). The IR lists a handler's leading controls in `FunctionCode.eventControls`
  (Vue's modifiers and Qwik's markers read them), and the invariants no longer ask every control to
  be listed: codegen's `handlerControls` reads the others from the body, by the event parameter.
- **A passive listener calls no `preventDefault()`** (UF3034, `passive-prevent-default`). The
  browser ignores it there on every target, and Angular runs a passive listener beside a
  non-passive one of its event in one listener, where the call would prevent. The rule follows the
  event into every local function the handler passes it to; the safe fix removes the call from a
  handler written in place, or the listener where the call is all it does. A passive listener that
  client code adds with `addEventListener` is not judged: no target merges it.
- **Handlers a keyboard user cannot reach are reported** (UF3030, `inaccessible-handler`), as
  Svelte 5.57.1's `a11y_click_events_have_key_events`, `a11y_interactive_supports_focus`,
  `a11y_mouse_events_have_key_events`, `a11y_no_noninteractive_element_interactions` and
  `a11y_no_static_element_interactions` define it, with Svelte's tables, one diagnostic per rule,
  for every target (G7, P4). It judges the source's listeners by their DOM event whatever their
  option, so it is never weaker than Svelte. A container that listens to a click its buttons
  receive takes `role="presentation"`, which every rule exempts.
- **Each target keeps the DOM's semantics, and spells each event by a table total over
  `DOM_EVENTS`**, pinned against the framework's own types or registration. Listeners of one event
  and phase on one element run in attribute order on every target:
  - **React**: react-dom 19.3's prop (`onKeyDown`, `onDoubleClick`, `onClickCapture`) where its
    synthetic event keeps the DOM's semantics. Elsewhere a native listener through the inline
    `listen` helper, typed over `HTMLElementEventMap`: `change` on anything but a `<select>` and a
    file input (so a text field's commits, and a checkbox's follows `input` and never a prevented
    click); the events React has no prop for; a non-passive `wheel`, `touchstart` or `touchmove`; a
    capture listener React has no prop for; every listener of an event a native listener on the same
    path hears; and `focus` and `blur` beside a native `focusin` or `focusout` on their path, so
    their order is the DOM's. An element's native listeners are one `listen` call per event and
    phase, from a ref callback declared once for the instance's life
    (`const [nameListeners] = useState(() => (element: Element | null) => listen(element, "change", …))`),
    so React never adds them again as it renders; they read props through mirrors, as deferred code
    (ADR-0046). The callback is written in place only where a listener reads a list's row or a value
    its branch narrows. A bubbling listener of an event that does not bubble (`focus`, `blur`,
    `load`, …) on an element that may hold its target first tests
    `event.target !== event.currentTarget`. Listeners of one event and phase merge into one handler:
    each listener's own code written out where it can stand among the others, an expression-bodied
    write as its statements, a guard clause at its top as the negated condition around the rest, and
    one that is async or returns otherwise as a local function the handler calls
    (`const clickListener = async () => {…}; void clickListener();`), so every listener after it
    starts in the dispatch. A `once` listener runs under `useOnce()`'s guard, which remembers each
    element it ran for. A setup function's event parameter is typed with React's synthetic type of
    its interface (`KeyboardEvent` from `react`).
  - **Vue**: `@click`, with the options as modifiers (`@click.capture`, `.once`, `.passive`). An
    inline handler whose expression body the template can hold stays in the template, as Vue's
    docs write it (`@click="quantity++"`, `@click="select(task.id)"`); one that reads its event, or
    is async, keeps its arrow; a handler that starts with unconditional controls writes them as
    `.stop` and `.prevent`, which run first, during dispatch. Anything else moves to a script
    function named `on<Event>`, its event typed as Vue's `Events` types it.
  - **Svelte**: `onclick`, `onclickcapture`. A listener Svelte has no attribute for (`once`,
    `passive`, an event `svelte/elements` does not type, a non-passive `touchstart`) is an
    attachment, `{@attach (node) => on(node, "wheel", zoom, { passive: true })}`, with `on` from
    `svelte/events`; a bubbling listener of an event another listener of the element attaches is
    attached too, so the two run in the source's order. A `once` listener's handler goes through
    `once`, an inline wrapper whose guard is set when the handler first runs
    (`on(node, "click", once(save))`), never `{ once: true }`, which an event a delegated
    descendant stopped would use up. A handler annotated with lib.dom's interface where Svelte's
    types hand it another takes the nearest one both extend; a union keeps its members where each
    event it receives extends one, and widens otherwise.
  - **Solid**: its event props (`onClick`, `onKeyDown`, `onDblClick`), pinned against its JSX
    types. Options are native: `on:click={{ handleEvent, once: true }}`. Where the component
    listens to a delegated event natively in the target or bubble phase (`once`, `passive`, or a
    handler typed as the DOM types it), its plain listeners of that event are native too
    (`on:click`), so they run in the DOM's order. An element's listeners of one event in one phase
    (`onClick` beside `onClickOnce`) are all added from its `ref` callback, in attribute order,
    which depends on no compiler order (`solid/jsx-no-duplicate-props` counts `onClick` and
    `on:click` as one prop).
  - **Angular**: `(click)="…"`, always a template statement: a named function's call (`save()`,
    `save($event)` when it takes the event), or an inline handler that is one call of a setup
    function or `emit` whose arguments Angular's expressions hold (`select(task.id)`,
    `share.emit([path])`, `greet({ ...owner, name: owner.name })`), which keeps the template typing
    a list's item and narrowing a prop; a state such a call reads is read from the class
    (`this.selected()`). A call that may return a value is `void toggle()`: Angular prevents the
    event when a listener's value is `false`. Any other inline handler moves to a `protected` method
    named after its element (`onAddOne`, `onEmailInput`), its event annotated from `DOM_EVENTS`,
    that returns nothing and keeps only what changes something (`a && b()` is `if (a) b();`,
    `return save();` is `this.save(); return;`, a read of a signal is no change). Options are an
    attribute directive per event and option that the file declares and exports,
    `(ufClickCapture)="…"`, which listens through `Renderer2.listen` with the option and works in
    `@if` and `@for`. The bubble listeners of one element and event, when there are two or three (a
    plain one beside a `once` or a `passive` one), are one template listener that chains their
    statements in attribute order, each as it would be alone, a `once` one under a guard,
    `once(clickOnce, $event) && …`, a method that marks the element in a `WeakSet<EventTarget>` per
    event; the chain's last statement is `void` where it may have a value. An event named after a
    JavaScript reserved word is emitted through `this.` (`this.delete.emit(id)`).
  - **Qwik**: `onClick$`, Qwik's names. Controls run at element scope only (codegen's
    `controls.ts`). At the top of a template listener (its leading statements: controls, an `if`
    on a test of the event alone around one control or one call, guard clauses on such a test, and
    calls of functions that make controls, read through `void`, `&&`, `||` and `?:`), an
    unconditional control is the element's `preventdefault:<event>` or `stoppropagation:<event>`,
    which Qwik's loader applies as it dispatches, beside a `sync$` making the same control where
    nothing else is left of the listeners (the loader listens only to events some element has a
    handler of); a control under a test of the event, or after such a guard clause (its test
    negated), runs in one merged `sync$` before the `$` handler, `onKeyDown$={[sync$(…), $(…)]}`,
    reading `event.currentTarget` as Qwik's element argument. A test that reads
    `defaultPrevented`, `cancelBubble` or `returnValue` is no test of the event alone. Every other
    control is `conditional-event-control`, a UF4001 error on Qwik (below). Both forms move the
    controls out of the `$` handler, as `qwik/no-async-prevent-default` asks, and a local function
    nothing is left of once its controls move goes, with the statements that only call it.
    `event.currentTarget` is the handler's second argument. The listeners of one element and event
    are one `$` handler that runs them in attribute order, each in a block of its own, a guard
    clause as the negated condition around the rest, and a handler that another listener of the
    dispatch may follow writes its calls of local functions in place, so it returns after its
    synchronous part. `once` is a module-level `WeakSet` per listener, checked first in its
    handler, which takes the element's markers off after its first run unless a listener that runs
    every time still needs them. `capture:click` and `passive:wheel` are native; where an element
    of the component listens to one event in both phases, every capture listener of that event
    runs from the window, guarded by `element.contains(event.target)`, and its controls are
    `conditional-event-control`; where the component listens to an event both passively and not,
    every listener of it is non-passive. A function client code hands to `addEventListener` is one
    QRL for the instance's life (`useConstant(() => $(…))`), so the listener one handler adds is
    the one another removes; two such functions that refer to each other read each other from a
    holder the component declares first.
  - **Astro**: nothing. A listener is inert (`interactivity` unsupported, ADR-0033).
- **A component declares its events once** (ADR-0012):
  `const emit = defineEmits<{ change: [value: number] }>()`, one type argument that is an object
  type literal or a local type, whose members are named tuples. A payload member's type is in the
  props subset (ADR-0034). Runtime arguments, the call-signature form, a label used twice and a
  second `defineEmits` are UF2009 (`invalid-emits`). An event's name is camelCase ASCII; does not
  start with `on` and a capital (angular-eslint's `no-output-on-prefix`); differs from every other
  event's name once lower-cased (Svelte); is no prop's name, nor is `on` with its lower-case name
  (Svelte's spelling), since a prop is public on every target; and is no keyword of Angular's
  template expressions (`if`, `as`, `this`, `typeof`, …, `@angular/compiler`'s `KEYWORDS`), no
  global those expressions read (`parseInt`) and not `constructor` (`reservedEventName`). Else it
  is UF2008 (`invalid-event-name`), with a safe fix that renames the declaration and every `emit`
  of it where a camelCase spelling is free. A JavaScript reserved word that Angular reads as a name
  (`delete`, `new`, `default`) names an event, and so does a setup binding's name
  (`function save() { emit("save"); }`).
- **`emit` is a statement** (UF2017, `invalid-emit`): `emit("change", count.value)`, with a
  string literal naming a declared event, no spread, and as many arguments as the tuple takes,
  optional members last. It returns nothing, and code must not depend on a listener having run:
  Qwik's listeners may run later (§4.5).
- **Each target exposes the events as its consumers expect:**

  | Target  | Declares                                                                | Emits                     |
  | ------- | ----------------------------------------------------------------------- | ------------------------- |
  | React   | `export interface CounterEvents { onChange?: (value: number) => void }` | `onChange?.(value)`       |
  | Vue     | `const emit = defineEmits<E>()`, right after `defineProps`              | `emit("change", value)`   |
  | Svelte  | `type Props = CounterProps & { onchange?: (value: number) => void }`    | `onchange?.(value)`       |
  | Solid   | `CounterEvents`, as React's                                             | `props.onChange?.(value)` |
  | Angular | `readonly change = output<number>()`                                    | `this.change.emit(value)` |
  | Qwik    | `CounterEvents { onChange$?: QRL<(value: number) => void> }`            | `onChange$?.(value)`      |
  | Astro   | nothing                                                                 | nothing                   |

  The props parameter is typed `CounterProps & CounterEvents`, or the events' type alone; only the
  events code emits are destructured, and a local that takes an event prop's name gets a renamed
  destructure. Vue writes `defineEmits<E>();` without a binding when nothing emits. Angular's
  output emits one value: nothing for `[]`, the value for one required member, and a tuple for
  more members or any optional one (`output<[path: string, note?: string]>()`), with exactly the
  arguments given; the test's mount adapter spreads it back (ADR-0050). An Angular output keeps
  its event's name, the component's API, also where a setup binding has it: the class's own member
  takes another name (`onSave` for a local function, `fieldElement` for a template ref,
  `currentPage` for any other value), since angular-eslint's `no-output-rename` rejects an alias.

- **Capabilities** (ADR-0033). M2 adds `event-capture`, `event-once`, `event-passive`,
  `event-semantics` and `conditional-event-control` beside `interactivity`, and `use-id`
  (ADR-0049), `next-tick` and `late-prop` (ADR-0048). Every target declares a cell for each:

  | Capability                  | React                    | Vue    | Svelte            | Solid                      | Angular               | Qwik                  | Astro                 |
  | --------------------------- | ------------------------ | ------ | ----------------- | -------------------------- | --------------------- | --------------------- | --------------------- |
  | `interactivity`             | native                   | native | native            | emulated (`createWatcher`) | native                | native                | unsupported (info)    |
  | `event-capture`             | native                   | native | native            | native                     | emulated (directive)  | native                | unsupported (info)    |
  | `event-once`                | emulated (`useOnce`)     | native | emulated (`once`) | native                     | emulated (directive)  | emulated (`once…`)    | unsupported (info)    |
  | `event-passive`             | native                   | native | native            | native                     | emulated (directive)  | native                | unsupported (info)    |
  | `event-semantics`           | emulated (`listen`)      | native | native            | native                     | native                | native                | unsupported (info)    |
  | `conditional-event-control` | native                   | native | native            | native                     | native                | unsupported (error)   | unsupported (info)    |
  | `use-id`                    | native                   | native | native            | native                     | emulated (`nextId`)   | native                | emulated (`uniqueId`) |
  | `next-tick`                 | emulated (`useNextTick`) | native | native            | emulated (`nextTick`)      | emulated (`nextTick`) | emulated (`nextTick`) | unsupported (info)    |
  | `late-prop`                 | native                   | native | native            | native                     | native                | unsupported (warning) | native                |

  `requiredCapabilities` derives `interactivity` from the first listener, template ref, watcher,
  `watchEffect` or lifecycle hook (`SETUP_ITEM_CAPABILITIES`, an exhaustive record),
  `event-semantics` from the first listener, each option's capability from its first listener,
  `use-id` from the first `useId()` and `next-tick` from the first `nextTick`.
  `conditional-event-control` is derived at a control, or a call that reaches one, that is not at
  the top of its template listener (`handlerControls`); at a `once` listener whose control depends
  on more than the event, or that is on an element listening to the event in both phases (a target
  that runs the control apart from the handler cannot tell the first event); at a capture
  listener's control where an element listens to its event in both phases; and where client code
  hands a local function that makes a control and reads the component's state to a call that may
  run it, or calls it outside a template listener's top (`handedControls`). A `once` guard
  remembers each element it ran for, as `{ once: true }` removes a listener from its own element
  only, so each row of a list runs once. Astro's `interactivity` reason says what a static target
  means: "Astro components render on the server only, and each render is a new instance: event
  handlers, template refs, watchers and lifecycle hooks never run, and state keeps its initial
  value."

- **Outside the contract** (each on the semantics page, with its portable spelling):
  - a continuation that a listener resumes may run after a later listener of the same event on
    React, Svelte and Solid (their delegated listeners have no microtask checkpoint between them)
    and in Angular's and Qwik's merged groups, where Vue may run it between two listeners of a
    person's input;
  - listeners that client code adds with `addEventListener` run in the DOM's order, but React,
    Svelte and Solid run the template's listeners from a delegated root (Solid at the document),
    and Qwik every template listener from its document capture listener, so `stopPropagation()` in
    a template listener cannot stop such a listener on an ancestor or the document, and an
    element's own added listener may run before a descendant's template listener;
  - on Qwik, a listener with a control under a test of the event is `[sync$, $]`, and Qwik's loader
    queues the `$` handler behind every handler of an earlier event that has not finished
    (qwikloader's `queuedTasks`): a handler that awaits what another event's handler does (a
    confirmation that waits for the next click) never resumes when both elements have such a
    control. Resolve such a confirmation from a listener with no conditional control, or do not
    await another listener inside a handler;
  - Qwik's first run of a listener whose code has not loaded (ADR-0050).
- **Amendments to ADR-0033.**
  - **Behavioural capabilities** (`BEHAVIOURAL_CAPABILITIES`: `interactivity`, `event-capture`,
    `event-once`, `event-passive`, `event-semantics`, `conditional-event-control`, `next-tick` and
    `late-prop`) change nothing a static render shows. The render-parity kit's check that an
    unsupported case still renders differently skips them: a case Astro marks inert renders
    exactly, and is compared like any other.
  - **A refining capability is reported only with its prerequisite.** `CAPABILITY_PREREQUISITES`
    ties the event options, `event-semantics`, `conditional-event-control` and `next-tick` to
    `interactivity`. Where `interactivity` is unsupported, the check reports it once, at its first
    use, and not each capability it refines: Astro notes one UF4001 info per module. A target
    written before M2 is reported for `interactivity` and `use-id` alone.
  - A capability may be an error on one target: Qwik's `conditional-event-control` is, so a
    component with such a control has no Qwik output, and its tests are skipped there for want of
    output (ADR-0050). The harness's L1 check of fixes leaves out, on both sides, every diagnostic
    a capability cell reports, whatever its severity.
- **Normalisation** (ADR-0031): the attributes Qwik's loader reads at dispatch
  (`preventdefault:`, `stoppropagation:`, `capture:`) and the passive scopes of its event
  attributes (`q-ep:`, `q-dp:`, `q-wp:`) are Qwik's own noise, removed from Qwik's output only.
- **Amendment to ADR-0042.** angular-eslint's `no-output-native` is off: it judges the author's
  event name (`change`), which every target keeps. The hazard it guards, a native `change` that
  bubbles out of the component and reaches a consumer's `(change)` on its host, needs a child
  component, and M3 decides it. `no-output-on-prefix` stays on, and UF2008 rejects such names;
  `no-output-rename` stays on, so Angular renames its own member rather than alias an output. The
  open item on Svelte's accessibility warnings is answered for the five that depend on a handler
  (UF3030); `a11y_no_redundant_roles`, `a11y_img_redundant_alt` and `a11y_invalid_attribute` stay
  open.

From `events/event-options`, a capture and a bubble listener on a container, and a once listener:

```text
Source   <div role="presentation" onClickCapture={() => record("panel capture")} onClick={…}>
         <button type="button" onClickOnce={() => record("once")}>
React    onClickCapture={() => record("panel capture")}
         onClick={(event) => { if (!clickOnce(event)) return; record("once"); }}
Vue      @click.capture="record('panel capture')"   @click.once="record('once')"
Svelte   onclickcapture={() => record("panel capture")}
         {@attach (node) => on(node, "click", once(() => record("once")))}
Solid    ref={(element) => element.addEventListener("click", () => record("panel capture"), { capture: true })}
         on:click={{ handleEvent: () => record("once"), once: true }}
Angular  (ufClickCapture)="record('panel capture')"   (ufClickOnce)="record('once')"
Qwik     window:onClick$={(event, element) => { if (!element.contains(event.target as Node)) return; … }}
         onClick$={async (_, element) => { if (onceClick.has(element)) return; onceClick.add(element); … }}
```

## Consequences

**Positive:**

- One listener means the DOM's event on seven targets: `change` commits, `focus` does not bubble,
  options and phases run in the DOM's order, the listeners of one event on one element run in
  attribute order, and `preventDefault()` takes effect.
- Everyday controls compile: a WAI-ARIA key handler's `switch`, a control beside other statements,
  a guard before a control. Where one target cannot run a control at dispatch, its capability cell
  says so at the control.
- Every target's events read as that framework's: callback props, an interface consumers can
  extend, Angular outputs and Qwik QRL props.
- An accessibility mistake Svelte's compiler would reject is reported on every target, with
  Svelte's own rules.

**Negative:**

- Authors lose members of the DOM's events that React does not copy (`isComposing`,
  `composedPath`, `offsetX`), a control after an `await`, `preventDefault()` in a passive
  listener, and a handler in a list that does more than one call.
- On Qwik, a component whose control is not at the top of a template listener (a `switch` case, a
  block beside other statements, a function handed to `addEventListener`) has no output:
  `events/keyboard-navigation` and `lifecycle/save-shortcut` are skipped there for want of output.
- Outputs carry helpers and indirections: React's `listen`, `useOnce` and stable ref callbacks,
  Svelte's `once`, Angular's option directives, guard method and moved methods, Qwik's `sync$`
  handlers, window capture listeners and `WeakSet`s.
- On Qwik, a capture listener that runs from the window cannot make a control at its element's
  place, so its control is `conditional-event-control` too.
- Declared limits, outside the corpus: on React, Angular and Qwik, which run an element's
  listeners of one event in one handler, an error one listener throws stops the later ones.
- Angular's tuple payloads read less naturally to an Angular consumer than one value, and a class
  member named like an event is renamed in the output.

**Open:**

- M3: a consumer's listeners on child components, `no-output-native`'s hazard, fallthrough of
  `onX` attributes, and models (`onOpenChange`, ADR-0012).
- Whether Qwik could lift a control in an `if` block on the event or a `switch` case into a
  `sync$`, which would give `events/keyboard-navigation` a Qwik output.
- Svelte's other accessibility warnings (ADR-0042).

## Alternatives considered

- **React's synthetic props for every event.** Idiomatic, but `change` on a text field would fire
  per key and `focus` would bubble on React alone, a difference found only by a test (P4).
- **Accept every DOM event member, and let React's L4 fail.** The author would get a React type
  error for a source that names no React.
- **Reject a control anywhere but at the top of the handler** (the first build's UF3033). It
  rejected the WAI-ARIA key handler and a control beside other statements, which every target but
  Qwik runs in place; a capability on Qwik says exactly where Qwik cannot.
- **Qwik: lift every control** (the second build): a window-scope `sync$` for an element whose
  every control prevents, and a module-level `sync$` for a function handed to
  `addEventListener`. Each round of that machinery brought the next review's critical bugs
  (controls applied to events elsewhere on the page, a handed function's control lost); element
  scope is the simpler exact model.
- **Qwik: order listeners across elements with a module-level wait** (`afterEarlierListeners`,
  the second build). It emulated Qwik's loader, and deadlocked a handler that awaits another
  element's event.
- **Angular: `afterNextRender` and `viewChild` to add option listeners.** They miss elements inside
  `@if` and `@for`; a directive goes wherever the element goes.
- **Angular: a method per listener group** (the second build). The class cannot always name a
  list's item type, and loses the template's narrowing; a chained template statement keeps both.
- **Angular: alias an output that a setup binding names** (`output({ alias: "save" })`).
  `no-output-rename` rejects it, and the event's name is the API every target keeps.
- **Svelte: `on(node, "click", h, { once: true })`.** Svelte runs the handlers it delegated below
  the element inside that listener, so an event a descendant stopped used the option up, and the
  handler never ran.
- **Qwik: `preventDefault()` inside the `$` handler.** It runs after dispatch on a listener's first
  run, once the segment loads, so the default has already happened, and
  `qwik/no-async-prevent-default` rejects it.
- **One event value on Angular, an object for several members.** It invents a payload shape the
  source does not declare, and an optional member would be indistinguishable from an absent one.
- **Keep `no-output-native` on, and rename Angular's outputs.** The event's name is the author's,
  and every other target keeps it; the hazard needs composition, which M3 brings.
- **Leave accessibility to L11.** axe runs on the rendered DOM and cannot see a listener, and
  Svelte's L3 would fail on Svelte alone.

## Evidence

- `packages/ir/test/events.test.ts`: "keeps the element events, the window's and the unsupported
  ones apart", "dispatches %s as a %s", "lets a listener be passive only where it lets scrolling go
  on", "gives each event an interface its DOM interface extends, with members", "lets a %s handler
  use %s's portable members" and "keeps %s's %s out".
  `packages/analyzer/test/events-conformance.test.ts` pins them against `@vue/runtime-dom` 3.5.43's
  vendored `Events`, TypeScript 7.0.2's lib.dom, react-dom 19.3.0 and @types/react 19.3.0: "is the
  authoring types' listeners, without `dragexit`, with the dialog's events", "reads every listener
  the vocabulary names, in Vue's spelling" and "names the interfaces lib.dom dispatches with, and
  members both the DOM's and React's events carry".
- `packages/analyzer/test/listeners.test.ts`: "lowers the DOM's event and its option", "renames
  React's and lower-case names, with a safe fix (UF3004)", "reports what no element listens to
  alike, two options and `Passive` where it does nothing (UF3006)", "reports a listener set twice
  for one event and option (UF3007)", "lowers a local function's name and an arrow function, its
  parameter the event", "reports any other handler (UF3029)", "takes an event parameter typed with
  a union of the events it handles, judged by their common interface", "reports a union that holds
  no interface of the event, and a member only some of its events have (UF3029, UF3032)" and
  "keeps a handler in a list to one call Angular's template statements read (UF3029)".
- `packages/analyzer/test/code.test.ts`: "records its members as `Event` references, and a
  handler's controls", "reports a control that runs after the event is dispatched (UF3033)",
  "accepts a control in an `if` block beside other statements, an `else if` chain and a `switch`
  case, listing only the leading ones", "accepts a control after a statement that may leave the
  handler on more than the event, listing none after it", "accepts a control after guard clauses
  that test only the event, and statements that cannot leave", "reads no name in a type: a cast's
  test reads only the event (UF3033)", "marks the parameter a handler passes its event to",
  "records an emit of a declared event with its arguments" and "reports an emit of no declared
  event, with the wrong arguments, or used as a value (UF2017)".
- `packages/analyzer/test/client-rules.test.ts`: "reports a call in the handler, in a function it
  names or passes its event to, once", "removes the call from a handler written in place, or the
  listener where it is all it does (safe)" and "accepts `stopPropagation()` in a passive listener,
  and `preventDefault()` in one that is not" (UF3034).
- `packages/analyzer/test/setup.test.ts`: "declares each event with its named payload", "reads the
  events of a local interface or type" and "reports a declaration of events in another form
  (UF2009)". `packages/analyzer/test/rules.test.ts`: "renames an event written otherwise, and its
  emits (safe)", "reports names that collide, without a fix", "accepts an event named like a
  function, a ref or a constant of the setup", "accepts a JavaScript reserved word that Angular's
  templates read as a name", "reports an Angular keyword, a global and `constructor`, without a
  fix", "reports a payload outside the props types, and a member named twice", "keeps a handler
  that reads a value a condition narrows to one call", "accepts a handler that only writes the
  value its branch tests, in an expression or a block body", "still counts a compound assignment's,
  an update's and a member write's target as a read", "reports a member some target's event lacks,
  and the event used whole" and "accepts portable members, and the event passed on to a local
  function's event parameter". `packages/ir/test/names.test.ts`: "keeps an event from the name %j"
  and "leaves the event name %j free".
- `packages/analyzer/test/a11y-conformance.test.ts` pins UF3030 against svelte 5.57.1: "are
  Svelte's" (the ten tables, against Svelte's `constants.js`), "reports %s as Svelte does" (each
  rule's trigger through `svelte/compiler`), "is what Svelte's compiler says of every element, with
  each handler, role and tabindex" (every HTML element but the document's own and `<slot>`, by 12
  attribute sets and 7 handler sets: over 8,000 elements, over 1,000 flagged, exactly as the
  compiler warns), "counts a listener with an option by its event, and a spread's keys as unknown
  values" and "accepts buttons, form controls, presentation, hidden elements and focusable roles".
- Controls and their capability: `packages/codegen/test/controls.test.ts` "finds a call under an
  `if` that tests only the event, with its test", "finds a call after guard clauses that test only
  the event, with their tests negated", "lifts a callee's control through a dispatched call, with
  the call's test", "is used at a `once` listener whose control runs under a condition", "is used
  at a `once` listener with a control on an element listening in both phases", "is used at a
  capture listener's control where an element listens in both phases", "keeps a control after a
  guard that reads defaultPrevented, or after another statement, in place", "reads a call through
  `void`, `&&` and `?:`, under their tests", "keeps a control in a block beside other statements,
  an `else` or a `switch` case in place", "finds each place a function that makes a control is
  handed or called apart from a listener" and "derives `conditional-event-control` where the first
  one is".
- `packages/codegen/test/capabilities.test.ts` "derives M2's capabilities, each where it is first
  used"; `packages/codegen/test/setup.test.ts` "derives interactivity from a listener, or from a
  template ref alone" and "names the behavioural capabilities and their prerequisites among the
  capabilities"; `packages/compiler/test/capabilities.test.ts` "reports interactivity once on a
  static target, not each listener option it refines", "reports a listener option a target cannot
  meet where it has interactivity" and "reports each capability a target written before M2 does
  not declare, refinements aside". Each target's cells: `packages/target-react/test/emit.test.ts`,
  `packages/target-solid/test/emit.test.ts`, `packages/target-angular/test/emit.test.ts` and
  `packages/target-qwik/test/emit.test.ts` "declares every capability",
  `packages/target-vue/test/emit.test.ts` "declares every capability, native but for
  single-selection list boxes", `packages/target-svelte/test/emit.test.ts` "declares every
  capability, natively but for once listeners" and `packages/target-astro/test/emit.test.ts`
  "declares every capability: what runs in the browser unsupported, `use-id` emulated";
  `tests/repo/test/targets-page.test.ts` "writes each target's cell as the target declares it".
- `packages/codegen/test/jsx.test.ts` "prints a listener and a template ref React's way by default"
  and "lets a dialect write listeners and template refs"; `packages/codegen/test/markup.test.ts`
  "writes Vue listeners with their modifiers, and refs, in `vue/attributes-order`", "writes
  Svelte's event attributes and `bind:this`", "writes Angular listeners from the statement its
  target supplies, and `#name` refs", "refuses a listener or a ref in Angular's literal region,
  where nothing binds" and "writes nothing for Astro's inert listeners and refs, and refuses them in
  plain HTML"; `packages/codegen/test/markup-escape.test.ts` "writes a listener's statements as an
  attribute's code" and "writes a listener's template statement as an attribute's, its statements
  apart".
- React 19.3.0: `packages/target-react/test/events.test.ts` "uses react-dom's registration name for
  each event it has a prop for", "declares every prop, and its capture prop where it has one, as
  @types/react does", "keeps React's prop where its synthetic event keeps the DOM's semantics",
  "listens natively where React's synthetic event differs from the DOM's", "tests the target where
  React runs a listener of an event that does not bubble for a descendant" and "types an event
  parameter with React's synthetic event of its interface";
  `packages/target-react/test/setup.test.ts` "prints listeners as React props or native listeners,
  with guards, merges and refs", "writes an expression-bodied write as statements in a handler the
  target writes (a guard, a once guard, a merge)", "adds an element's native listeners of one event
  and phase in one call, from a ref callback declared once", "listens natively to focus beside a
  native focusin, and to a checkbox's change", "runs listeners merged into one handler as written:
  early returns as conditions, async and other early-returning listeners as local functions it
  calls", "declares the events interface and renames an event prop a local function takes" and
  "emits through the props object, and types a component without props by its events";
  `packages/target-react/test/behaviour.browser.test.ts` "runs a once listener once per element,
  and lets a later click through", "hears a wheel through a passive listener", "hears a text
  field's change when it commits, and a focus only at its target" (which fails without the target
  test), "runs two native listeners of one event on one element, when the first writes state",
  "keeps the DOM's order of focus and focusin, and of a checkbox's click, input and change",
  "starts every listener of an event in its dispatch, after an async one awaits" and "runs a
  listener that returns early beside another of its event, each as written";
  `packages/target-react/test/toolchain.test.ts` "rejects a DOM event type on a React listener's
  parameter" and "types a native listener of every event the target may listen to natively".
- Vue 3.5.43: `packages/target-vue/test/behaviour.browser.test.ts` "runs a capture listener before
  the target's, and a bubble listener after", "stops propagation through `.stop`, before the
  handler", "runs a once listener once", "passes the event to an inline arrow, and runs a handler
  the template cannot hold" and "listens to the wheel passively";
  `packages/target-vue/test/typecheck.test.ts` "takes a handler typed as Vue types its event, and
  refuses lib.dom's where they differ"; `packages/target-vue/test/emit.test.ts` "declares the events
  without a binding when nothing calls `emit`"; `packages/target-vue/test/lint.test.ts` "rejects
  $what ($rule)" on "a listener before another attribute", "an `emit` nothing calls" and "an event
  the component does not declare".
- Svelte 5.57.1: `packages/target-svelte/test/events.test.ts` "has a cell for every event of the
  IR's vocabulary, and no other", "reads each event's handler type from svelte/elements, where it
  declares an attribute", "writes the events Svelte types no attribute for, or makes passive, as
  attachments", "writes a bubbling listener beside an attached one of its event as an attachment
  too" and "hands an attribute's handler Svelte's interface, and an attachment's lib.dom's";
  `packages/target-svelte/test/emit.test.ts` "joins the events' callback props to the props type
  and destructures those it calls", "writes the listeners Svelte has no attribute for as
  attachments, in the source's order", "annotates a handler's event with what Svelte's types hand
  it", "keeps a union event parameter Svelte's events fit, and widens one they do not" and "guards
  a once listener with the once helper, never the option";
  `packages/target-svelte/test/behaviour.browser.test.ts` "keeps the phases, the once option and
  the order of one element's listeners", "keeps a container's once listener for the first click a
  descendant does not stop" and "listens to wheel passively and to touchstart actively, as the DOM
  does".
- Solid 1.9.15 (dom-expressions 0.40.10): `packages/target-solid/test/listeners.test.ts` "names
  every DOM event as Solid's types do, but one they spell only natively", "delegates the events
  Solid's compiler delegates", "writes a listener with an option as a native listener with its
  options", "listens natively to a delegated event the component also listens to once", "adds a
  second listener of one event from the element's ref callback, beside its template ref" and "adds a
  listener its event's prop cannot type from the element's ref callback";
  `packages/target-solid/test/behaviour.browser.test.ts` "keeps the DOM's order, phases and options
  for every listener"; `packages/target-solid/test/lint.test.ts` "rejects $what ($rule)" on "two
  listeners of one event on one element as props". babel-preset-solid 1.9.15 emits an element's
  `ref` and its native listener props in the reverse of their attribute order, a probe's finding.
- Angular 22.2.1, angular-eslint 22.5.0: `packages/target-angular/test/setup.test.ts` "calls a
  setup function from the template, with `$event` when it takes the event", "writes an emit or a
  call of literals and inputs as a template statement", "drops the value of a function that
  returns one (Angular prevents the event for `false`)", "emits an event named after a JavaScript
  keyword through `this.`", "moves any other handler to a method named after its element, dropping
  its value", "listens with an option through a directive the file declares", "are one template
  listener, which chains their statements in their attributes' order", "calls the method a handler
  moved to from the chain, one that awaits included", "keeps a list's variables in the template,
  which types them, and a passive one in the chain", "keeps what the template types and narrows in
  the chain, and the source's names apart", "take no name a list's variable has, which would shadow
  them in the list" and "keep the event's name, and rename the class's own member, never aliasing
  the output"; `packages/target-angular/test/events.browser.test.ts` "listens with the option each
  listener asks for", "runs a capture listener before the target's, and a bubble one after", "runs
  a once listener once, then lets clicks through to its container", "listens to wheel passively: it
  cannot prevent the scroll", "never prevents a key from an expression-bodied handler whose value is
  `false`", "listens to change, input, focus and blur as the DOM fires them", "run in their
  attributes' order beside an option, a once one only the first time", "call a setup function, then
  the once listener that reads what it wrote", "run a once listener once per row of a list, and a
  passive one beside the others", "run in a list over a computed or a prop's member, in a narrowed
  branch, by their own names", "never prevents the event, in a list or not, inline, moved to a
  method or by name", "emit from template statements and methods" and "arrive by the event's name,
  from the renamed function, state and template ref";
  `packages/target-angular/test/state.browser.test.ts` "gives each event's payload by its shape, in
  the order the handlers emit"; `packages/target-angular/test/lint.test.ts` "names an output after
  a DOM event, as the author does (ADR-0012)".
- ngtsc imports each directive a template uses, so an option directive the file does not export
  fails with NG3004; a directive listens when its element is created, before the template's
  `ɵɵlistener`; `@angular/compiler` 22.2.1 makes a template statement's last expression the
  listener's value: probes' and readings' findings.
- Qwik 2.0.0-beta.47: `packages/target-qwik/test/events.test.ts` "names every event of the
  vocabulary, as Qwik's runtime reads the name back" and "names a component's events as the QRL
  props a parent sets"; `packages/target-qwik/test/setup.test.ts` "names listeners by Qwik's event
  props and moves event controls to the loader", "reads event.currentTarget as Qwik's element
  argument", "writes capture, passive and once, and a capture listener beside a bubble one from the
  window", "runs the listeners of one element and event in one handler, in attribute order",
  "keeps a marker that a listener running every time needs after a once listener's first run",
  "lifts a called function's control under the call's test of the event, or on every event",
  "declares a once listener's conditional control unsupported", "listens non-passively where the
  component also listens to the event otherwise", "passes Qwik's element to a sync$ whose test
  reads currentTarget, own or a call's", "merges an element's controls into one sync$ beside its
  handler, on the element", "gives each listener of a merged handler a block, the element only
  where read, and one floating function", "runs a merged listener that returns early under its
  guards' negation, or as a local function", "keeps a listener of a control that is all its handler
  does: the marker beside a sync$", "drops a helper that is only a control, with the statements
  that only call it", "declares a capture listener's control unsupported where an element listens
  in both phases", "declares a control after a guard on defaultPrevented, or after another
  statement, unsupported", "declares a local function with a control that client code hands to
  addEventListener unsupported", "keeps one QRL for the instance's life of a function client code
  adds or removes", "writes two functions that reference each other so both exist, through a
  holder" and "declares each event's QRL prop beside the props type, and calls it";
  `packages/target-qwik/test/behaviour.browser.test.ts` "runs a container's capture listener before
  the target's, its bubble listener after", "runs a once listener once, its stopPropagation() with
  it", "prevents defaults while the event is dispatched, conditionally too, and reads
  currentTarget", "keeps preventing a submission after a once listener's first run", "prevents only
  the key a helper's call tests for: typing still works", "runs one element's listeners in
  attribute order, before its container's", "runs a passive listener before its container's
  non-passive one", "keeps a listener whose handler only prevents: the form is not submitted, the
  focus stays" and "stops a click on a backdrop itself, and prevents a link's own click, at
  dispatch"; `packages/target-qwik/test/lint.test.ts` "rejects $what ($rule)" on
  "preventDefault() in a $() handler".
- Qwik's loader, read in `@qwik.dev/core` 2.0.0-beta.47's `dist/qwikloader.debug.js`: an element's
  markers apply only while it dispatches an event the loader listens to; a handler that returns a
  promise sets `defer`, and every later handler of the dispatch is queued on the module-level
  `queuedTasks`, behind every pending handler of an earlier dispatch. A `sync$` handler first in
  an element's array leaves its `$` handler queued so, which is the `[sync$, $]` difference above.
- `packages/testing/test/normalize.rules.test.ts` "removes %s from that target's output", on "Qwik
  2 passive listeners" and "Qwik 2 listener options its loader reads at dispatch".
  `tests/integration/harness/compile-checks.unit.test.ts` "passes a fix that lets the compiler
  report a target's notes, which are no problems" and "passes a fix that brings a capability
  cell's warning, whatever its severity".
- The corpus cases `events/function-handlers`, `events/inline-handlers`, `events/event-options`,
  `events/keys`, `events/emit-payloads`, `events/async-handlers`, `events/list-handlers`,
  `events/form-events`, `events/listener-order`, `events/focus-and-change`,
  `events/helper-controls`, `events/guard-controls`, `events/list-pairs`,
  `events/listener-pairs`, `events/control-only-listeners`, `events/keyboard-navigation`,
  `events/conditional-controls`, `semantics/emit`, `semantics/prevent-default` and
  `semantics/nested-call-bubbling`, and every M2 diagnostics case of this record's codes, are
  green at every live layer on all seven targets; `events/keyboard-navigation`,
  `events/conditional-controls` and `lifecycle/save-shortcut` have no Qwik output (its
  `conditional-event-control` error), and their tests are skipped there for want of output.
