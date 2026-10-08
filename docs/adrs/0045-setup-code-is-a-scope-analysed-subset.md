# ADR-0045: Setup code is a scope-analysed subset, in source order

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §4.2, §4.5, §4.6, §5.3, §5.4, §9 M2; G2, P2, P3, P5, P6, P8; R1, R4, R5, R6;
  ADR-0001, ADR-0006, ADR-0008, ADR-0015; amends ADR-0032, ADR-0034, ADR-0035, ADR-0039 and
  ADR-0042

## Context

ADR-0001 makes a component a function whose body runs once, and plan §4.2 lists what that body
declares: state, derived values, effects, lifecycle hooks, template refs, ids, and local functions
and constants, kept in source order. M1 lowered only the props and the returned JSX: a read of
anything the body declared was UF1002, "reading it lands in M2" (ADR-0035). M2 lowers the body.

Every target puts the body somewhere else, and runs it at other times:

- **React runs the body on every render** (R1). A `const` is evaluated again, a reassigned `let`
  fails the React Compiler's `immutability` rule, and React Compiler 1.0 bails out (an L3
  warning) on code it cannot compile yet: `finally`, a `try` without a `catch`, a `throw` or a
  value block (`?.`, `??`, `?:`) inside a `try` block, `for await`, some defaults, a logical
  assignment and an update of a variable a closure captures.
- **Angular moves the body into a class.** Fields are initialised before any input is set, and a
  nested `function` rebinds `this`.
- **Qwik moves every `$` closure into a segment that loads lazily.** A segment captures its
  variables when `$()` runs, so a declaration after it is a temporal dead zone. A plain `let` is
  copied into each segment that captures it. A plain function cannot be captured at all
  (optimizer C02), and calling a `$()` function returns a promise.
- **Svelte and Solid lint setup-time reads.** Svelte warns `state_referenced_locally` (which fails
  L3) where the script's top level reads a prop or state, and `solid/reactivity` (L5) where the
  setup reads a prop outside `untrack`.
- **Astro's frontmatter runs on the server only**, and Vue's `<script setup>` is the source's own
  code.

So the compiler must know what each piece of setup code reads and writes, what it emits, whether
it touches the DOM or awaits, and when it runs. P2 forbids copying anything it has not analysed.

Three adversarial reviews of the first build found two kinds of fault. Some rules let a divergence
through silently: a change through a shallow copy's member, a type query of a prop, a write as a
nested arrow's value. Others rejected everyday, portable code for one target's sake: a `throw` in
a `try` block, `fetch`, `URLSearchParams`. Both are bugs. The subset may be narrower than Vue, but
never silent (P2), and a rule exists only for the divergence it prevents.

## Decision

- **The authoring import is checked** (ADR-0006). A component imports named values from
  `"unframework"`. M2's ten APIs (`ref`, `computed`, `watch`, `watchEffect`, `onMounted`,
  `onUnmounted`, `nextTick`, `defineEmits`, `useTemplateRef`, `useId`) are recognised by the
  binding the import declares, never by name: an alias is the API, and a local `ref` is not. M3's
  `defineModel`, `defineSlots`, `defineExpose`, `defineOptions`, `provide` and `inject` are UF1002,
  naming M3. `reactive`, `toRefs`, any other name, and a namespace or default import are UF2016
  (`unknown-api`). Type-only imports of the authoring types are accepted.
- **Every top-level statement of the body is classified**, in source order:

  | Statement                                          | Setup item              | Binding kind  |
  | -------------------------------------------------- | ----------------------- | ------------- |
  | `const count = ref(0)`, `ref<T>()`                 | `State`                 | `state`       |
  | `const total = computed(() => …)`                  | `Derived`               | `derived`     |
  | `const field = useTemplateRef<HTMLInputElement>()` | `TemplateRef`           | `templateRef` |
  | `const id = useId()`                               | `Id`                    | `localConst`  |
  | `const emit = defineEmits<{ … }>()`                | the component's `emits` | `emit`        |
  | `const rates = { … }`                              | `Const`                 | `localConst`  |
  | `let timer: number \| undefined`                   | `Variable`              | `localVar`    |
  | `function save() {…}`, `const save = () => …`      | `Function` (`form`)     | `localFn`     |
  | `watch(source, callback, options?)`                | `Watch`                 |               |
  | `watchEffect(effect, options?)`                    | `WatchEffect`           |               |
  | `onMounted(callback)`, `onUnmounted(callback)`     | `Lifecycle`             |               |

  Nothing else stays. Any other expression statement, and an `if` or a loop at the top level, is
  UF1002: the setup runs once, so its help says to run the code from `onMounted`, a handler or a
  local function. Plan §5.3's `Statement` item is not built. `var`, several declarators in one
  statement, a destructuring declaration, a function expression and a type declared in the body
  are UF1002 too. JSX kept in a variable is UF3012. A `return` before the last statement is UF2012
  (`conditional-return`). The only directive is `"use strict"`.

- **Macros and APIs are called at the top level** (plan §4.2): as a statement, or as a top-level
  `const`'s value. Anywhere else, or used as a value, is UF2005 (`misplaced-reactive-call`). A
  result that must be bound and is not (`ref(0);`, a `let`, a pattern) is UF2006
  (`unbound-macro-result`), with a likely `const emit = ` fix for `defineEmits`. `nextTick` is a
  function that client code calls anywhere, bare and awaited (UF2025, ADR-0048).
- **The IR records code, not syntax** (P5, `packages/ir/src/types.ts`). `UfComponent` gains
  `setup: SetupItem[]`, always present, and `emits?`. Setup code is a `Code { code, span, refs }`,
  the exact source slice, which targets rewrite by splicing at its references, as ADR-0035's
  expressions. Its references are `Binding` and `Global`, as in M1, and `Write`, `Emit`, `Api`
  (`nextTick`) and `Event` (ADR-0047). A function is a `FunctionCode` of parts: `async`, its
  parameters (a name or a destructuring pattern with its names, a type, `optional`, `rest`, a
  static default, and `event` on a handler's event), its return type, its body, whether the body
  is an expression, and its leading event controls. A target prints it back as written, or
  rebuilds it (Angular's methods).
  - **A ref is read through `.value`, and its reference spans `x.value`** for a `state`, a
    `derived` and a `templateRef` binding, as the object form's reference spans `props.x`: each
    target respells the value read (`count`, `count()`, `this.count()`, `countRef.current`). A
    ref used bare where its value is meant is UF3026 (`ref-without-value`), with a safe fix to
    `x.value`. The bare ref is read only as a watch source (`watch(count, …)`) and in
    `ref={field}`, which the IR records by binding id.
  - A `Binding` reference has `call` where it is a call's callee (`format(total.value)`). Only a
    `localFn` is called.
  - **A narrowed read is marked** (ADR-0046). `BindingReference.narrowed` lists the paths of a
    read of a prop or of a ref's value that a condition around it shows present, where the read
    relies on it: the reference itself or a member path off it (`selected.value`,
    `draft.value.email`), each with its `scope`, `local` (no function between the condition and
    the read), `closure` (a setup function's condition around a destructured prop's read) or
    `template` (the template's conditional around a handler). A compound write's target that a
    condition narrows carries one `local` path (`WriteReference.narrowed`). The targets that read
    through a call or a mirror assert those paths; TypeScript narrows the source's own spelling.
  - **A deferred read is marked** (ADR-0048). `BindingReference.later` is set on every reference
    in a function client code hands to a call that runs it later or never (a timer's callback, a
    promise's `then`, `addEventListener`, an observer, `onCleanup`), written in place or held in a
    local `const` only such calls receive. `summarizeTracked` leaves those references out of what
    a `watchEffect` tracks.
- **Every piece of code runs in one of three contexts**, and reads only its context's globals
  (`packages/ir/src/names.ts`, `packages/ir/src/browser.ts`):
  - **render**, the returned JSX's expressions: `ALLOWED_GLOBALS` (ADR-0035);
  - **pure**, the initial values of `ref`, `const` and `let`, and the getters of `computed` and of
    watch sources: `PURE_GLOBALS`, render's and `Map`, `Set`, `WeakMap`, `WeakSet`, `Symbol`,
    `Error`, `TypeError`, `RangeError` and `structuredClone`;
  - **client**, handlers, watch callbacks, `watchEffect`, lifecycle hooks and the local functions
    they call: `CLIENT_GLOBALS`, pure's with every global the browser declares, `console`,
    `Promise`, `Date`, `Intl`, `performance` and `crypto`. The browser's globals are lib.dom's
    own: `LIB_DOM_GLOBALS` holds every `declare var`, `declare function` and `declare namespace`
    name of TypeScript 7.0.2's `lib.dom.d.ts` (925 names, the same set as TypeScript 6.0.2's).
    `BROWSER_GLOBALS` is that set without the timers (`SCHEDULING_GLOBALS`: `setTimeout`,
    `clearTimeout`, `setInterval`, `clearInterval`, `queueMicrotask`), the pure and runtime
    globals, and `WINDOW_MEMBER_GLOBALS`: the `window` members whose bare name reads like the
    component's own (`name`, `status`, `top`, `length`, `event`, `open`, `close`, `focus`,
    `innerWidth`, `scrollY`, the `on…` handler properties), create-react-app's
    `confusing-browser-globals` as lib.dom declares them, but `history`, `location` and
    `confirm`. Client code reads those through `window`: a bare one is UF3020, with a likely fix
    to `window.innerWidth`. Of all of them, only `readsDom`'s read the DOM a render changes
    (UF2018 and the `post` invariant, ADR-0048).

  Render and pure code are deterministic: UF3019 also covers getters, initial values and the
  functions they call, and a client-only global in pure code is UF3020. Pure code may use
  TypeScript's syntax, since it is script or class code on every target, never an Angular template.

- **Client code is a subset of JavaScript.** Statements: `const` and `let`, `if`, `for`,
  `for…of` and `for await`, `while`, `do…while`, `switch`, `break`, `continue`, `return`,
  `throw`, `try` with a `catch`, a `finally` or both, blocks and expression statements.
  Expressions: M1's (ADR-0035), plus arrow functions with either body, `await` in an async
  function, `new` of a global the context reads, BigInt literals, assignments and updates of
  function-local names, writes of state and setup `let`s, and TypeScript's `as`, `!`, `satisfies`
  and annotations. UF1002, each with its reason: `var`; labels and `debugger`; `for…in` (write
  `for (const key of Object.keys(object))`); a nested `function` declaration or a function
  expression (Angular's methods would rebind `this`; write an arrow); a class, a generator or a
  type declared in code; `this`, `super`, `arguments`, `new.target`, `import.meta` and
  `import()`; methods, getters and setters in object literals; and a type assertion on the target
  of a write of state or of a setup `let` (`count.value! = 2`, `(timer as number) = …`), which
  the outputs respell (a setter, a signal's `set`, a ref's `current`), with a likely fix that
  writes the target bare.
- **React opts out of React Compiler, the language does not shrink.** A shape React Compiler 1.0
  cannot compile yet is the language's on every target. The React target finds such shapes in its
  own output (`packages/target-react/src/bailouts.ts`): a value block (`?.`, an optional call,
  `??`, `&&`, `||`, `?:`, a loop, a comma or a destructuring default) or a `throw` inside a `try`
  block, a `try` without a `catch` or with a `finally`, a destructured `catch` parameter, a
  default or a `case` test it cannot reorder, a `for` head without a declaration or a test,
  `for await`, a BigInt literal, a computed key in a pattern, a type assertion on an assignment's
  target, and a few more. Where the component's code holds one, its body starts with a comment
  naming the first shape and `"use no memo";` (ADR-0046). React's own spelling can make one: an
  emit is an optional call (`onSaved?.(id)`), so an emit inside a `try` block opts out.
- **A type query names no component value** (UF1002). A `typeof` query in setup code, a local
  function or a handler (`typeof mode.value`, `ReturnType<typeof save>`, `keyof typeof labels`)
  whose root names a prop, the props parameter, a list's variable, a setup binding or an authoring
  API is UF1002 at the query, with a help that says to write the type: the outputs respell or
  erase every one of those names. A query of a function-local name, a parameter, an import other
  than the authoring API's or a global (`typeof setInterval`) is accepted, as is one in the
  props' own annotation.
- **A write is a statement of its own** (UF2011, `invalid-write`). A write of a state's value
  (`=`, `+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `&&=`, `||=`, `??=`, `++`, `--`) or of a setup `let`
  is the whole expression of an expression statement, or the expression body of a function whose
  value the framework drops: an inline handler, a watcher's callback, `watchEffect`, a lifecycle
  hook or an `onCleanup` callback. The IR records it as a `Write` with its operator and the spans
  of its target and value, so React, Solid and Angular rewrite it into a setter call
  (ADR-0046). An arrow passed to any other call writes in a block body: the fix gives it one,
  safe where the call drops the arrow's value (`setTimeout`, `setInterval`, `queueMicrotask`,
  `requestAnimationFrame`, `requestIdleCallback`, `addEventListener`, `forEach`) and likely
  elsewhere (`map` and `then` use it). Writes nest inside another write's value or an emit's
  arguments: `timer = setInterval(() => { count.value++; }, 1000)`. A setup function whose
  expression body is a write is UF2011, with a safe fix that writes a block body. A write in
  render or pure code, or of a destructured prop (the object form stays UF2001), a derived value,
  a template ref, a constant, a function, `emit` or a loop variable, is UF2011. A bitwise or shift
  compound write of state is UF1002.
- **State is replaced whole** (ADR-0008, which stays Proposed), and no target's state is deep: Vue
  declares state with `shallowRef` and Svelte with `$state.raw` where it may hold an object
  (ADR-0046). UF2004 (`in-place-mutation`) reports, in client and pure code, a member assignment
  (a destructuring's and a `for…of`'s target included), `delete` of a member, `++` or `--` on a
  member, a call of a method that changes its receiver (`push`, `pop`, `shift`, `unshift`,
  `splice`, `sort`, `reverse`, `fill`, `copyWithin`, and a `Map`'s or a `Set`'s `set`, `add`,
  `delete` and `clear`) and `Object.assign` and its kin on their first argument, unless the
  value's provenance allows it (`packages/analyzer/src/origins.ts`):
  - a value's provenance is the set of origins of every value it may hold: `fresh` (a literal,
    `new`, a spread copy, the new array a copying method returns whatever its receiver,
    `Array.from`, `Object.values` and their kin), `clone` (`structuredClone`, `JSON.parse`),
    `element` (a template ref's, the event's `currentTarget`, `target` and `relatedTarget`, and
    what a query or an iteration of one reaches), `event`, `global`, or `other`. A change is
    accepted only where no origin is `other`;
  - a member of a `fresh` value is `other` (a shallow copy shares its members with state), unless
    the code wrote a fresh value there itself: a literal's member written after its last spread
    (`{ ...x, tags: [...x.tags] }`), or a container whose every member write is fresh
    (`byKind[kind] = []`, `byKind[kind] ??= []`). A member of a `clone` is a `clone`;
  - a local, a setup `let`, a loop's variable, an array method's item and a `reduce` callback's
    accumulator hold what every value written to them anywhere in the component holds (its
    initial value and what the callback returns, for an accumulator); `a ?? b` and `a || b` hold
    both sides;
  - `classList`, `style` and `dataset` methods change an element, never a collection of state's;
    UF3028 judges them (ADR-0049).

  A ref's value, a prop, a list's item, a constant, a parameter, a member of a copy and a name
  that may hold one of them are reported. Where the result is unused and the value is a state's,
  the likely fix writes the value whole: `[...x.value, item]`, `{ ...x.value, key: v }` only
  where the state's kinds are object shapes (never an array, a `Map`, a `Set` or `unknown`),
  `toSorted`, `toReversed` and `toSpliced`, `x.value.slice(0, n)` (or `[]` for `0`) for an
  array's `length`, and for a destructuring assignment of a ref's members
  (`[items.value[i], items.value[j]] = …`) a copy that the assignment changes and then writes whole.

- **Each local function has a summary.** `summarize(component)` in `@unframework/ir` derives,
  from the references, what each `localFn` does, through what it calls: the functions it calls and
  reaches, the bindings it reads, its writes, its emits, `nextTick`, `async`, template-ref and
  setup-`let` reads, client-only globals, whether it escapes (is passed as a value) and its event
  controls. `summarizeTracked` does the same without the references marked `later`. The
  analyser, the invariants and every target read the same summaries. The rules on them:
  - **Purity** (UF2014, `impure-function-call`). A template or an initial value calls only a pure
    function: one that does not write, emit, await or call `nextTick`, and reads no template ref,
    setup `let` or client-only global. A getter calls only a function whose transitive reads are
    static constants (`Const` items that read no binding): Qwik moves such a function, with its
    constants, to module scope, since a `$` closure cannot capture it.
  - **Functions as values** (UF2022, `function-value`). A local function is a value only as a
    call's argument in client code (`setTimeout(tick, 100)`). A callback or a getter given by name
    (`onMounted(start)`) is UF2022, with a safe fix that wraps it in an arrow.
  - **Direct calls** (UF2024, `unsafe-local-call`). A function that touches state (it writes, emits,
    calls `nextTick`, or reads a template ref or a binding other than a static constant) is called
    directly in the body of a handler, a callback, a hook or a function, in an `async` arrow, or in
    a callback that runs later, never in an arrow that runs at once and whose result counts (a
    `forEach` callback, a comparator): Qwik makes such a function a QRL, whose call only a direct
    call can await. A call runs a function it is given `now`, `later` or `never`: the timers,
    `queueMicrotask`, `requestAnimationFrame`, `requestIdleCallback`, `then`, `catch`, `finally`,
    `addEventListener`, an observer's constructor and `onCleanup` run it later (`window.setTimeout`
    too); `removeEventListener`, `clearTimeout`, `clearInterval`, `cancelAnimationFrame` and
    `cancelIdleCallback` never run it; any other call may run it at once. Client code passes a
    state-touching function only to a call that runs it later or never, and a call inside a `const`
    handed only to such calls belongs to that function. A function that returns a promise (`async`,
    or annotated `Promise<…>`) may be called and passed anywhere: a QRL's call gives a promise of
    the same value (`await Promise.all(items.map(load))`). No local function recurses, directly or
    through another.
  - **Reads before declaration** (UF2023, `read-before-declaration`). Code the setup runs (initial
    values, getters, watch sources, an immediate watcher's first callback, and the functions they
    call) reads only the bindings declared before its item. A `function` declaration is hoisted:
    code may call one declared after it, judged by what the function reads and reaches; an arrow
    `const` is not, and is called only after its declaration. Client code reads any binding.
- **Setup runs once** (§4.5). A `const` whose value reads a prop, a state or a derived value, itself
  or through what it calls, is UF2007 (`setup-once-read`), a warning: it keeps its first value on
  every target (ADR-0046). The likely fix wraps the value in `computed(() => …)`, rewrites every
  read of the constant to `.value`, and imports `computed`. `ref(initial)` is the idiom for seeding
  state from a prop, and is not reported.
- **Types.** Every type annotation in setup code is a root of `collectTypes`, so a local interface
  that `ref<Item[]>`, `defineEmits<E>` or a parameter names lands in `component.types`. A type only
  setup code reaches is checked for copying (declared once, in ASCII, not `declare`, no text that
  ends a block), not against the props subset; an event's payload keeps the props subset (UF2009,
  ADR-0047). A type predicate (`value is T`, `asserts value is T`, `asserts value`) is a local
  function's return type like any other, and every target prints it. An authoring type (`Ref`,
  `OnCleanup`) in a copied annotation is UF2019 (`erased-type-reference`), with a likely fix that
  removes an annotation the context infers. A generic local function is UF1002.
- **Names.** A setup binding follows the parameter rules (`reservedParameterName`) and
  `reservedSetupName` (UF2003): a strict-mode reserved word, `constructor`, `/^ng[A-Z]/`
  (Angular's lifecycle hooks), `/^use[A-Z0-9]/` (React's rules of hooks) and a trailing `$`
  (Qwik's QRLs). A parameter of a local function, a handler or a callback the IR holds is an ASCII
  identifier (UF2003), since Angular's methods and template statements name it; a nested arrow's
  parameters and a body's locals may take any name. A local or a parameter in setup and client
  code named like a prop, the props parameter, a setup binding, `emit`, an enclosing list's
  variable, `props` or `rawProps` is UF3024 (`shadowed-binding`), because no target renames an
  author's local. Each target claims the names it adds (setters, mirrors, helpers, imports)
  through `NameScope`, around `sourceNames`, which reads every name setup code and handlers
  declare or read and the type names their annotations read.
- **Each setup statement and each inline handler is checked once** for lint directives (UF1002,
  ADR-0042) and for text that would end a block (ADR-0051).
- **Plugins** may move, copy or drop analysed code, never write it: `pluginIrProblems` compares
  every `Code` and `FunctionCode`, each setup item's type and the `emits` whole with what the
  analyser produced, and reports anything else as UF8001 (ADR-0035's rule, extended). A function
  is keyed by its context, its role and its value, and a piece of code by its context, its kind
  and its value, so analysed client code cannot move into a getter, an initial value or a
  constant.
- **Targets keep source order, and move what captures nothing to module scope.** React, Solid and
  Qwik hoist a `const` or a function whose code, followed through what it calls, reads no name of
  the component's, in source order, as a developer of those frameworks would; their emitter tests
  pin it, since L5 no longer asks for it (below). Every target keeps the setup items in source order
  as far as its idiom allows: Vue puts `defineEmits` after `defineProps`; Angular's class puts its
  inputs, outputs, view queries and injected services first, and a function passed as a value (an
  arrow field) before the setup's own fields, so a field initialiser that calls it finds it; React
  moves an item that reads a binding declared after it below that declaration (React Compiler
  rejects a read before a declaration, between two `function` declarations too), declares local
  functions that refer to each other in a cycle in one `useState` initialiser, and orders its
  effects as ADR-0048 says; Qwik moves a declaration that a task or a `$` closure captures up before
  it, never a task down.
- **Amendments to ADR-0032.** The invariants check the setup as the analyser guarantees it (else
  UF9001): each item's binding exists with its item's kind and has one item; items lie in span order
  before the render; a reference's text is the binding's name, `props.name` or `name.value`; render
  code holds no template ref, setup `let`, emit or call of an impure function; pure code holds no
  write, emit, `nextTick`, template ref or setup `let`; a `Write` targets a state or a setup `let`
  with an accepted operator, its value inside it; an `Emit` names a declared event with as many
  arguments as its tuple allows; an `Api` reference is called with no argument (`nextTick()`);
  references are sorted, and overlap only inside a write's value or an emit's arguments; globals
  follow the context; `call` is only on a `localFn`; getters call only functions over static
  constants; nothing is read before its declaration, a call of a `function` declaration judged by
  what it reads and reaches; no function recurses; a setup function's expression body is never
  exactly a write or an emit; parameters take no reserved, prop or component name, their defaults
  are static, and a rest parameter is last; a `narrowed` path starts at its reference, is a member
  path off it with a known scope, shortest first, and a write's narrowed path spans its state's
  target where the operator reads it; a reference marked `later` lies in client code; a
  `watchEffect` reads no setup `let` or template ref but in what it hands on to run later
  (`summarizeTracked`); a watcher that is neither immediate nor post reads no template ref and none
  of `readsDom`'s globals, itself or through what it calls, before the first `await nextTick()` of
  its callback (the `post` invariant, a safety net for plugins, looser than UF2018's); and an event
  control is a `preventDefault()` or `stopPropagation()` call of the handler's event, though the
  body may make others it does not list (UF3033 is the analyser's alone: the IR holds no statements
  to tell a dispatched control from a deferred one).
- **Amendments to ADR-0034.** `/^on[A-Z]/` stays a reserved prop name, now because it is an
  event's (UF2003: a component declares its events with `defineEmits`, ADR-0012), and a member of
  a function type is UF1002 because callbacks are events. A prop only client code reads counts as
  read on every target that prints client code (`referencedBindings` with `includeClient`), so Vue
  destructures `interval` in `lifecycle/unmount-timers`; Astro, which prints none, leaves it out.
- **Amendments to ADR-0035.** References resolve to setup bindings too, so UF1002's "reading it
  lands in M2" is gone, and UF3020 names the setup's bindings and the context's globals. A
  template may call a pure local function. UF3021 stays the rule of templates: handlers write, as
  statements.
- **Amendment to ADR-0039.** A spread of a setup value stays UF1002, which now says it lands with
  fallthrough in M3.
- **Amendment to ADR-0042.** Svelte's `svelte/prefer-svelte-reactivity` is off: it judges the
  author's own `new Map()`, `new Set()` or `new Date()` in a handler, which the client subset
  allows (a fresh value may change), and the target makes no such value.
- **Amendment to ADR-0042: L5 leaves the author's statements to the author.** Seven unicorn rules
  of the shared oxlint baseline are off on all seven targets, each with its reason in
  `output.oxlintrc.json`. `unicorn/consistent-function-scoping` judges where the author nests a
  helper (`const report = (extra) => {…}` inside a handler). `unicorn/no-array-sort`,
  `no-array-reverse`, `no-instanceof-builtins`, `no-new-array`,
  `no-single-promise-in-promise-methods` and `prefer-add-event-listener` judge one correct
  spelling of the author's code over another (`sort()` on the new array `filter` returns,
  `value instanceof Array`, `new Array(3)`, `Promise.all([one])`, `window.onresize = …`). Every
  target but Astro copies those statements, so each rule failed some targets' copy and not
  another's (P4), and no target writes such code itself. Rules that catch a bug an emitter could
  also write (`no-unused-vars`, `no-unnecessary-await`) stay on.
- **Amendment to ADR-0042: Qwik's typed rules run**, which closes its open item. M2's Qwik
  outputs hold `$` closures, so L5 runs eslint-plugin-qwik's `qwik/valid-lexical-scope` and
  `qwik/use-async-top` as errors: a `$` scope captures only what Qwik can serialise, never a plain
  function or a `let` it assigns. oxlint gives a JS plugin no types, and typescript-eslint cannot
  load TypeScript 7, the Qwik toolchain's own for tsgo (L4). So the two rules run in ESLint, from
  a lint host on TypeScript 6, `tests/toolchains/qwik-eslint`: a package beside the toolchain,
  which installs it, since one package resolves one `typescript` and Turborepo refuses a package
  nested in another. The host's configuration holds the two rules alone, and oxlint keeps them
  off. ESLint types the files by the toolchain's `tsconfig.json`, the one tsgo extends
  (`lintWithEslint` with a `tsconfig`), so the rules judge a scope's captures by the types L4
  proved. No emitter changed: every Qwik golden output was clean under both rules.

The Counter of plan §4.1, in the IR (`state/counter`):

```text
const count = ref(initial);                       State     count@274    initial "initial"
const doubled = computed(() => count.value * 2);  Derived   doubled@304  getter, Binding count.value
function increment() {                            Function  increment@359, a declaration
  count.value += step;                              Write "+=" of count@274, value "step"
  emit("change", count.value);                      Emit "change", argument "count.value"
}
```

## Consequences

**Positive:**

- Every name in setup code is resolved and classified before it reaches an output (P2), and each
  target rewrites code by splicing at references (§5.4), so an author's formatting and comments
  survive.
- One summary of each function drives the analyser's rules, the invariants, React's mirrors and
  effect dependencies, Qwik's QRLs, Angular's members and every target's `watchEffect`
  dependencies, so they cannot disagree about what a function does.
- Client code may name any global the browser declares, and use `finally`, a `throw` in a `try`
  block and the other shapes React Compiler cannot compile yet: what one target's compiler cannot
  compile is that target's to opt out of.
- Source order is kept as far as each target's idiom allows, and Qwik and React depart from it only
  where a closure or React Compiler needs a declaration first: plan §5.3's "order is never lost"
  holds.

**Negative:**

- Authors lose JavaScript that TypeScript accepts: top-level statements, destructuring
  declarations, function expressions, labels, recursion, a type query of a component's value, a
  change in place of what state shares, and a call of a state-touching function inside
  `forEach`. Each diagnostic says why.
- The rules are conservative. UF2004 rejects a change to a parameter even where every caller passes
  a fresh value, and its provenance is flow-insensitive:
  `const next = { ...x.value }; next.tags = [...next.tags]; next.tags.push(t)` is reported. UF2014
  rejects a getter's call of a function that reads a prop, which every target but Qwik could make.
- A React output that holds a shape React Compiler 1.0 cannot compile loses the compiler's
  memoisation for the whole component, and the list of shapes must follow React Compiler: L3
  fails an opt-out the compiler no longer needs.
- Qwik's order can differ from the source's, and its outputs are longer: every function client
  code calls is a `$()` QRL, awaited where its value is used or its call is a statement.
- Qwik's L5 runs two linters, and its typed rules need TypeScript 6 in a lint host of their own
  until typescript-eslint loads TypeScript 7.

**Open:**

- UF2004 accepts a fresh value that code writes into state and then changes in place
  (`const copy = [...x.value]; x.value = copy; copy.push(1)`): order-sensitive aliasing needs a
  flow analysis. No corpus case has the shape.
- M3: spreads of setup values, models, slots, `defineExpose`, `defineOptions`, `provide` and
  `inject`. M5: module-level constants, imports of `.ts` and `.uf.ts` modules, generic functions,
  and a type oracle for the kinds.

## Alternatives considered

- **A `Statement` item that copies other top-level code** (plan §5.3). It would run once on Vue,
  on every render on React and only on the server on Astro: no target could keep "setup runs once"
  without knowing what the statement does. The help names the place that runs code once.
- **Analyse handlers as M1 analyses expressions.** Handlers need blocks, loops, `await` and local
  variables, and React, Solid and Angular need writes as structures to rewrite them.
- **Copy local functions as written, with no summary.** React's mirrors and effect dependencies,
  Qwik's `$` rules and Angular's `this` all depend on what a function does and on what it calls.
- **Accept nested `function` declarations and function expressions.** Angular's methods would
  rebind `this` inside them; arrows keep it, and are one form for one concept (P3).
- **Allow in-place mutation, and lower it to a copy.** Plan §3 makes deep reactive proxies a 1.0
  non-goal, and the setter-based targets would need a helper (ADR-0015) or far more syntax to
  classify (ADR-0008).
- **Judge in-place mutation by syntax** (the first build). It let a change through a shallow
  copy's member, a global function's result, or a `let` given state in another function pass
  silently, and it rejected `filter(…).sort()`; provenance judges where a value comes from.
- **Reject what React Compiler cannot compile, for every target** (the first build's `finally`,
  then a review's longer list). It rejected everyday code (an emit or a `throw` inside a `try`
  block) on seven targets for one target's compiler, which has an opt-out of its own.
- **A fixed list of browser globals** (the first build's thirteen). Everyday client code names
  `fetch`, `URLSearchParams`, `AbortController`, `history` and the observers; lib.dom's own
  declarations are the whole list, pinned against both TypeScript versions.
- **Accept any call of a local function from a getter.** Qwik's `useComputed$` is a `$` closure,
  which cannot capture a function that reads the component's values.

## Evidence

- `packages/ir/test/ir.test.ts`: "writes the setup's keys in the order of the types", "finds
  every function in source order, with its context and role", "finds the setup's values and every
  function's body, then the handlers', with contexts", "finds only the template's expressions, not
  the setup's or the handlers' code", "summarises what each local function does", "follows calls
  transitively, and marks a function passed as a value", "leaves the references marked `later` out
  of what code tracks" and "finds every span in the module, each at its pointer".
  `packages/ir/test/invariants.test.ts` "checkInvariants on the setup, events and template refs"
  breaks each amendment of ADR-0032, and "checkInvariants on narrowed reads" the `narrowed`
  paths. `packages/ir/test/names.test.ts`: "nests the globals of each context: render, pure, then
  client", "let client code read the browser's globals, and `window`'s confusing members through
  it", "keeps a setup binding from the name %j" and "leaves the setup binding name %j free".
  `packages/ir/test/schema.test.ts` "name every setup item, handler, watch source and code
  reference kind in the schema".
- `packages/analyzer/test/globals-conformance.test.ts` runs each TypeScript's `tsc --listFilesOnly`
  and reads the lib.dom it lists: "are every name lib.dom declares, in %s" (for TypeScript 7.0.2 and
  6.0.2) and "split lib.dom between what client code reads by name and through `window`".
- `packages/analyzer/test/authoring.test.ts`: "is what the package exports: M2's APIs, M3's, and
  its types" (it parses `packages/unframework/src/index.ts`), "reports what is not the API
  (UF2016), and M3's APIs as landing in M3 (UF1002)" and "recognises the API by binding, not by
  name: a local `ref` is no API".
- `packages/analyzer/test/setup.test.ts`: "classifies every kind of statement, in source order",
  "declares each binding at its identifier, with its kind", "reads `const`s, ids and refs' values
  in a template, a ref's value spanning `x.value`", "calls a local function from a template as a
  call reference", "reports an API called inside other code or used as a value (UF2005)",
  "reports a macro whose result is not bound by a `const` (UF2006), binding `emit` with a fix",
  "reports a return before the last statement (UF2012)", "reports what the setup would run once,
  `var` and destructuring (UF1002)", "reports JSX kept in a variable, and a local function that
  returns JSX (UF3012)", "copies a type only the setup's code reaches, and still reports one
  nothing reaches", "reports a setup binding whose name a target reserves (UF2003)", "reports a
  function's or a handler's parameter that is no ASCII identifier (UF2003)", "accepts a name that
  is no ASCII identifier inside a function's body" and "accepts `use strict`, and reports any
  other directive".
- `packages/analyzer/test/type-queries.test.ts`: "reports a query of a setup binding, in setup
  code, a local function and a handler", "reports a query of a prop, of the props parameter and of
  a list's variable", "reports a query of the authoring API, whose import the compiler erases",
  "accepts a query of a function-local name, a global and a parameter" and "leaves a query in the
  props' own annotation to the props".
- `packages/analyzer/test/code.test.ts`: "records a write of state or a setup `let` as a
  statement, with its operator", "records an `onCleanup` callback whose expression body is a write
  as its body", "reports a write as the expression body of an arrow passed to a call, with a
  block-body fix", "keeps an emit as the expression body of an arrow passed to a call", "records a
  write that is a discarded arrow body with its parentheses", "reports a write inside an
  expression, or one a setup function returns, with a block-body fix (UF2011)", "reports a write
  of what code does not write, and one in a getter (UF2011)", "reports a bitwise or shift write of
  state as not supported (UF1002)", "accepts statements and TypeScript's syntax", "reports what no
  target writes alike (UF1002)", "accepts what React opts out of the React Compiler for", "reports
  a type assertion on the target of a write of state or of a setup `let`, with a likely fix
  (UF1002)", "accepts a `throw` in a `catch`, in an arrow or a function a `try` calls, and the
  loops the React Compiler lowers", "records `nextTick` and the browser's globals in client code",
  "is read as `x.value` (UF3026), with a fix where it is the ref alone" and "reports a spread of a
  setup value as landing in M3 (UF1002)".
- `packages/analyzer/test/rules.test.ts`, UF2004: "reports a change of a ref's value in place,
  with the likely fix where its result is unused", "offers the object spread only for an object
  shape, and cuts an array short with its `length`", "reports a change through an alias, a
  callback's parameter, a parameter, a prop and a constant", "accepts a change of what the code
  builds, an element, the event, a global and a setup `let`", "reports a change of what a shallow
  copy holds, of a global function's result's members, and of a `let` given state", "accepts a
  change of a copy itself, of a deep copy and all it holds, and of a `let` only ever given fresh
  values", "accepts sorting or reversing the new array a copying method returns, state's too",
  "accepts changing a member the code wrote fresh: a literal's after its spreads, a container's
  every write, a `Map`'s through `??`", "reports a member a spread copied, one written from state,
  and an item of a copy", "accepts a `reduce` accumulator built fresh, and a member a logical
  assignment writes fresh", "reports an accumulator that starts as state's value or as an item, and
  a logical assignment of state's" and "reports a destructuring assignment's and a loop's member
  targets, with the fix that writes a copy whole".
- `packages/analyzer/test/rules.test.ts`, the other rules: "warns about a constant that reads a
  prop, a ref or a computed value, with the likely fix", "imports `computed` where the module does
  not", "reports a template calling an impure function", "reports a getter calling a function over
  anything but static constants", "reports what reads the clock, chance or the locale, directly or
  through a function (UF3019)", "reports a global only client code reads, in a getter or an
  initial value (UF3020)", "accepts any global lib.dom declares in client code", "reports a
  `window` member whose bare name reads like the component's own, with a likely fix", "reports an
  authoring type in a copied annotation, with the likely fix where it is inferred", "wraps a
  callback passed by name (safe)", "accepts a local function passed as a call's argument in client
  code", "reports what code the setup runs reads before it is declared", "accepts client code
  reading what comes later", "accepts a call of a `function` declared later, judged by what it
  reads and reaches", "reports an arrow called before it is declared, and what a later `function`
  reads late", "reports a function that touches state called or passed in a callback that runs at
  once", "accepts a function that returns a promise anywhere, and any call in an `async`
  callback", "accepts a call in a function the code hands on by name, but not in a callback inside
  it", "reports a function that returns no promise, in a synchronous callback inside an `async`
  one", "accepts a function passed to a call that runs it later or never runs it", "words the
  message by the call a function is passed to", "reports a function that calls itself, directly
  or through another", "accepts direct calls, deferred callbacks and pure functions in callbacks"
  and "reports a local named as a prop, a setup binding, `emit`, a list variable or `props`".
- `packages/analyzer/test/corpus.test.ts`: "%s triggers exactly its code", for each of the 33
  diagnostics cases M2 adds, and "%s compiles with no error, and only its own warnings", for every
  feature case (`semantics/setup-once` warns UF2007, Astro notes UF4001). In
  `packages/analyzer/test/fixes.test.ts`, "random mixes of fixable pieces in a setup's component"
  applies every fix and recompiles: "recompile to exactly the diagnostics that have no fix (seed
  %i)".
- `packages/analyzer/test/props.test.ts` "reports the prop name %s (UF2003)" holds the reason
  `onClick` now gives. `packages/codegen/test/setup.test.ts`: "counts every binding code reads,
  writes, emits through, calls or attaches", "reserves what setup code and handlers declare and
  read, parameters and annotations' types", "reads the names the type predicate %s asserts, not
  its parameter" and "prints every function of the counter back as the source writes it".
  `packages/codegen/test/rewrite-code.test.ts`: "rewrites a write nested in another's value
  first", "tells the binding rule a local function is called" and "passes the site to every
  rule".
- `packages/compiler/test/plugin-ir.test.ts`: "accepts the analysed module, and analysed functions
  moved, copied or dropped", and "rejects %s" for a write turned into a read, a parameter's type
  changed, a setup value the plugin wrote, an event's payload changed, a local function moved into
  a getter or into a lifecycle hook and a local function's body moved into a constant's value,
  each with exactly one problem. `packages/compiler/test/compile.test.ts` "rejects an ir hook's
  result that moves a local function into a getter, once".
- Hoisting and order: `packages/target-react/test/setup.test.ts` "evaluates a setup const once,
  and hoists what captures nothing to module scope", "declares a function before the effects that
  read it, wherever the source declares it" and "declares a listener that removes itself and the
  helper it calls in one initializer, as neither may read the other before its declaration";
  `packages/target-solid/test/setup.test.ts` "hoists what captures nothing of the component to
  module scope"; `packages/target-qwik/test/setup.test.ts` "moves what captures nothing to module
  scope, and keeps a constant reading a prop once" and "keeps hooks and watchers in source order,
  moving up what they read that is declared later"; `packages/target-angular/test/setup.test.ts`
  "declares a function passed as a value before the fields whose initialisers call it". The
  corpus case `state/helpers-after-use` calls a `function` declaration from two initial values, a
  getter and a handler before its declaration, green on all seven targets.
- React Compiler 1.0.0 (babel-plugin-react-compiler, on Babel 7):
  `packages/target-react/test/toolchain.test.ts` "opts out where React Compiler 1.0 cannot compile
  %s" (39 probes, each detected with its reason, bailing out without the directive and clean
  with it), "opts out where a prop's default is one React Compiler cannot reorder", "compiles a
  component whose code holds %s, without opting out" (20 neighbours), "reports an opt-out React
  Compiler does not need, and a bailout that is not its reason" and "bails out on $what, which the
  target writes otherwise", on "a logical assignment" and "an update of a variable a closure
  captures"; `packages/target-react/test/setup.test.ts` "opts a component out of React Compiler
  where its code holds what React Compiler cannot compile yet, saying why". The corpus case
  `state/react-compiler-shapes` (an emit, `??`, `?:` and a `throw` inside a `try` block,
  `finally`, defaults that read state) is green at every live layer on all seven targets, its
  React output opted out.
- Qwik's optimizer 2.1.0-beta.9 refuses a `$` closure that captures a plain function (C02), a
  probe's finding; `packages/target-qwik/test/setup.test.ts` "makes a function client code calls a
  $() QRL, awaits its calls and makes callers async".
- `packages/target-svelte/test/lint.test.ts` "accepts $what", on the row "a handler that fills a
  Map of its own". With `svelte/prefer-svelte-reactivity` on, eslint-plugin-svelte 3.23.0 reports
  that handler's `new Map()`, a probe's finding.
- `tests/integration/harness/toolchain-lint.unit.test.ts` "%s leaves the author's own statements
  to the author (ADR-0042)" reads each target's effective configuration (`--print-config`) and
  finds the seven unicorn rules off. Before, a handler holding a nested helper failed
  `unicorn/consistent-function-scoping` on React, Vue, Svelte, Solid and Qwik, and
  `state/derived-arrays` failed `unicorn/no-array-sort` and `no-array-reverse` on all seven, a
  probe's finding.
- Qwik's typed rules, with ESLint 10.11.0, typescript-eslint 8.71.0, eslint-plugin-qwik
  2.0.0-beta.47 and TypeScript 6.0.3: `packages/target-qwik/test/lint.test.ts` "rejects $what
  ($rule)" on "a $ scope that captures a local function" and "a $ scope that assigns a captured
  let" (`qwik/valid-lexical-scope`) and on "an async computed read after another statement in a
  QRL" (`qwik/use-async-top`), each with no other message, "accepts every committed golden output,
  with no message" and "refuses to run without its configuration, or over a file it cannot lint";
  `tests/integration/harness/toolchain-lint.unit.test.ts` "%s runs its type-aware rules in ESLint
  alone, from a lint host on TypeScript 6"; `packages/codegen/test/toolchain-node-lint.test.ts`
  "types the files for type-aware rules through a temporary tsconfig".
- With TypeScript 7.0.2 as the plugin's `typescript`, ESLint runs Qwik's typed rules into
  "TypeError: Cannot read properties of undefined (reading 'Any')", a probe's finding.
- Versions: oxc 0.152, `@typescript-eslint/scope-manager` 8.71.0, TypeScript 7.0.2. The corpus
  holds 178 cases; M2's 67 feature cases (`state/local-functions`, `state/derived-arrays`,
  `effects/persistence-and-fetch` and `state/react-compiler-shapes` among them) are green at every
  live layer on all seven targets, and no feature case has a diagnostic but its declared ones.
