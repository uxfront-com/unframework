# ADR-0046: State and derived values keep one contract on every target

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §4.2, §4.5 (Setup runs once, Reactive props, Read after write, Derived consistency,
  Keyed lists, Determinism), §6, §9 M2; G2, P2, P4, P6; R1, R5, R6; ADR-0008, ADR-0014,
  ADR-0034, ADR-0035, ADR-0045; amends ADR-0036

## Context

Plan §4.5 is the semantics contract: Vue's behaviour is the reference wherever every target can
meet it. For state, it promises that setup runs once, that a read after a write sees the write,
and that a computed value is consistent whenever it is read. Plan §6 maps `ref` to `useState`,
`ref`, `$state`, `createSignal`, `signal`, `useSignal` and a constant, and `computed` to
`useMemo`, `computed`, `$derived`, `createMemo`, `computed`, `useComputed$` and a constant. The
frameworks' models differ in ways those cells hide:

- **React's state is a snapshot of a render** (R1). A read after a setter call in the same handler
  sees the old value; code after an `await`, or in a timer, sees the render it was created in; a
  `useMemo` recomputes only on the next render; and the body, `const`s included, runs again on
  every render. React Compiler 1.0 cannot compile some code the subset admits (ADR-0045).
- **Angular sets inputs after construction** (R5). A field initialiser that reads a required input
  throws NG0950, and reads an optional one's default.
- **Vue's `ref` and Svelte's `$state` proxy an object or an array deeply**, so the value a
  listener receives, and its identity, are no longer the source's object, and `structuredClone`
  of it throws.
- **Solid runs an effect once per write outside `batch`**, and M1's keyed `<Show>` and `<Match>`
  create their DOM again whenever their value changes, so focus is lost (ADR-0036's open item).
- **Solid and Angular read state through a call**, which TypeScript never narrows: a read after
  `if (selected.value)` that type-checks in the source fails L4 there.
- **Qwik copies a plain `let` into each segment** that captures it, and its optimizer turns a
  destructured prop's read into a live `props.x` read, so a plain `const` that reads a prop
  follows it.
- **React's reconciler reuses an element** of the same type at the same place across a
  conditional's branches, where Vue, Svelte, Solid and Angular replace it. Focus and typed text
  stay on React only (`semantics/deferred-reads`, `state/narrowed-reads`).
- **Astro renders on the server**, and each render is a new instance.

## Decision

- **The contract for state** (each rule has its `semantics/*` case, and the docs under
  `apps/web/content/docs/2.components` state it for users):
  - **Setup runs once** per instance. A `const` keeps its first value; state seeded from a prop
    (`ref(initial)`) keeps the value the prop had at creation (`semantics/setup-once`,
    `semantics/props-seed-state`, `semantics/props-seed-let`). On Astro each render is a new
    instance, so a spec that checks what survives a rerender requires `interactivity` (ADR-0050).
  - **Reactive props** are M1's: a template, a `computed` or a watch getter that reads a prop
    follows it (`semantics/derived-from-props`). A prop absent at mount that a parent adds later
    is followed by the template on every target, and by a `computed` or a watcher on all but Qwik
    (`late-prop`, ADR-0048).
  - **Read after write**: a read of a ref in client code sees every write before it, in the same
    function, in a function it called, in another listener of the same event, after `await`, and
    in deferred code (`semantics/read-after-write`).
  - **Deferred reads**: a timer, a promise's continuation or a callback that `onMounted`
    scheduled reads the latest state and props, never a render's snapshot
    (`semantics/deferred-reads`).
  - **Derived consistency**: a `computed` read in client code right after a write of what it reads
    is consistent (`semantics/derived-consistency`). A getter must be total over every state the
    component can reach, as React's `useMemo` and Solid's `createMemo` may evaluate it eagerly.
  - **Identity**: state holds the source's own value, so a state given a prop's item is that item,
    and `structuredClone` copies it (`state/identity-and-clone`).
  - **Keyed lists** keep content and order. DOM identity on a reorder is not guaranteed in M2
    (ADR-0036; plan M8): no spec reorders a list, or replaces a row's item, while focus is in it.
  - **Determinism**: rendering is a pure function of props and state (ADR-0045).
- **Value kinds** (ADR-0035's model) cover the setup, as TypeScript infers it: `ref(x)` widens a
  fresh literal deeply (`ref(flag ? 1 : 2)` is `number`), keeps what it reads (`ref(size)`) and an
  `as` type; `ref<T>()` is `T | undefined` and `ref()` `undefined`; a `computed` and a local
  function give the union of what they return, a single fresh literal widened, a union of literals
  kept; a `const` keeps its literal; `useId()` is `string`; a template ref is `T | null`; an
  annotation wins. `a && b` of a boolean `a` gives `false`.
- **State has a type every output can declare** (UF2021, `untyped-state`): `ref()` with neither a
  type argument nor a value, a setup `let` without an annotation whose value is absent,
  `undefined` or `null`, an annotated setup `let` without a value whose type leaves out
  `undefined` (`let started: number;`, and `let started!: number;`), and state whose kinds hold a
  function (React's setter would call it) are reported. React's `useRef` and Qwik's `useSignal`
  declare an unassigned `let` as `undefined`, so its annotation must admit it. `ref(null)` is not
  reported: TypeScript types it `Ref<null>`, which the source's own check holds to.
- **A narrowing the source relies on survives every target's spelling.** The analyser marks each
  read of a prop or of a ref's value, or a member path off it, that a condition around it shows
  present and that the read uses as present (`BindingReference.narrowed`, ADR-0045): a guard clause,
  a truthiness test, `!= null`, `?.` in a test, `typeof`, `Array.isArray`, a discriminant, and an
  assignment before the read in its function (`selected.value = member; selected.value.email`). A
  compound write's target narrowed so is marked too (`if (count.value !== null) count.value += 1`).
  Each target that reads such a value through a call or a mirror asserts the path (`selected()!`,
  `this.draft().email!`), or reads the rendered value where the template's condition narrows a
  handler's read. `if (selected.value) emit("select", selected.value)` and
  `computed(() => user ? user.name : "Guest")` are accepted.
- **A union of kinds is narrowed through a local** (UF3031, `ref-narrowing`). TypeScript keeps a
  narrowing to one kind of a union (`typeof`, `Array.isArray`, a literal, a discriminant of object
  shapes) on no target's call, and no assertion expresses it. So a ref's value, a prop or a member
  of either whose kinds are a union of non-nullish kinds is used, where a condition narrows its
  kind, only as a member every kind has, a test, an equality's operand, a string's part or an
  argument a parameter takes whole; read into a local, returned, assigned or put in a literal that
  goes to a call only where the written type of the local, the result or the target holds every
  kind. The likely fix reads the value into a local before the first statement that narrows it
  (the guard clause, or the outermost `if`, `?:` or `&&`), never where the region writes it or
  awaits. A value an assignment narrows to one kind (`value.value = "abc"; value.value.length`)
  is UF3031 with no fix: keep it in a local. The same holds for a prop read in a getter, an
  initial value or client code; the template narrows as it always has, and a conditional child
  narrows its branch on every target (Solid's accessor, Angular's `@let`).
- **Each target lowers state and derived values its own way:**

  | Source             | React                               | Vue                       | Svelte                       | Solid              | Angular                              | Qwik                   | Astro             |
  | ------------------ | ----------------------------------- | ------------------------- | ---------------------------- | ------------------ | ------------------------------------ | ---------------------- | ----------------- |
  | `ref(x)`           | `useState(x)` and a mirror `useRef` | `ref(x)`, `shallowRef(x)` | `$state(x)`, `$state.raw(x)` | `createSignal(x)`  | `signal(x)`, `linkedSignal` (inputs) | `useSignal(x)`         | `const`, cast     |
  | `computed(fn)`     | `useMemo(fn, deps)`, a live getter  | `computed(fn)`            | `$derived`, `$derived.by`    | `createMemo(fn)`   | `computed(fn)`                       | `useComputed$(fn)`     | `const`, `getX()` |
  | `const` that reads | `useState(() => …)`                 | as written                | `untrack(() => …)`           | `untrack(() => …)` | `computed(() => untracked(…))`       | `useConstant(() => …)` | as written        |
  | `const`, static    | module scope                        | as written                | as written                   | module scope       | `readonly` field                     | module scope           | as written        |
  | `let`              | `useRef<T>(…)`                      | as written                | as written                   | as written         | a field, or `x!` set in `ngOnInit`   | `useSignal<T>(…)`      | dropped           |

  The Counter of plan §4.1 (`state/counter`):

  ```text
  Source   const count = ref(initial);
           const doubled = computed(() => count.value * 2);
           count.value += step;  emit("change", count.value);
  React    const [count, setCount] = useState(initial);  const countRef = useRef(count);
           const doubled = useMemo(() => count * 2, [count]);
           countRef.current += step;  setCount(countRef.current);  onChange?.(countRef.current);
  Svelte   let count = $state(untrack(() => initial));  const doubled = $derived(count * 2);
           count += step;  onchange?.(count);
  Solid    const [count, setCount] = createSignal(untrack(() => props.initial));
           const doubled = createMemo(() => count() * 2);
           setCount(count() + props.step);  props.onChange?.(count());
  Angular  protected readonly count = linkedSignal(() => untracked(() => this.initial()));
           protected readonly doubled = computed(() => this.count() * 2);
           ngOnInit(): void { this.count(); }
           this.count.update((count) => count + this.step());  this.change.emit(this.count());
  Qwik     const count = useSignal(initial);  const doubled = useComputed$(() => count.value * 2);
           count.value += step;  onChange$?.(count.value);           (in a $() QRL)
  Astro    const count = initial;  const doubled = count * 2;
  ```

  Vue's script is the source's, `.value` and all, and its template reads `count` and writes
  `count++`, as Vue unwraps a `<script setup>` ref there.

- **React** (R1) keeps the contract with mirror refs, not snapshots of each render:
  - every state that client code writes has a mirror, `useRef(count)`. A write sets the mirror,
    then calls the setter with it (`countRef.current += step; setCount(countRef.current);`), and
    every read in client code reads the mirror, so a later read, another listener of the same
    event, a called function and code after `await` all see the write. Render reads the state.
    State nothing writes has no setter (`const [items] = useState(…)`), and an initial value that
    calls or constructs is passed as `() => …`. Shadows and functional updaters are not used;
  - a `computed` is `useMemo` over every prop, state, derived value and component-scoped name it
    reads (React's exhaustive dependencies), where render code reads it: the template, a getter, a
    watch source or a `watchEffect`. Client code reads a live getter over the mirrors
    (`function currentTotal() { return seatsRef.current * pricePerSeat; }`), so a read right after a
    write is consistent; a `computed` only client code reads has no memo. A function that both the
    template and client code call gets a client variant that reads the mirrors;
  - a prop or an event's prop that deferred code reads (after an `await`, in a nested function, in
    a function passed as a value, a native listener, and what they call) gets a mirror synced in
    `useLayoutEffect`, which runs in the commit, before any passive effect or deferred
    continuation can;
  - a local function client code passes as a value (to `addEventListener`, a timer, an observer) is
    created once for the instance's life,
    `const [onKey] = useState(() => (event: KeyboardEvent) => {…})`, so the listener one handler
    adds is the one another removes; it reads through mirrors, as deferred code;
  - a setup `const` that reads the component's values is `useState(() => …)`, evaluated once; one
    that reads nothing is at module scope; a setup `let` is `useRef<T>(…)`, read through `.current`;
  - a narrowed read: a read a template's condition narrows for a handler written in its branch
    (a `template` path) is the rendered value, which TypeScript narrows there as in the source;
    every other client read keeps its mirror or live getter, whatever condition is around it, and
    a path React's spelling does not narrow (a live getter's call, a prop's mirror in a closure) is
    asserted (`currentSelected()!.name`, `ownerRef.current!.name`);
  - writes the React Compiler cannot lower are written out: `x = x ?? y` for `x ??= y`, and an
    update of a variable a closure captures as a compound assignment, `x += 1` where its value is
    dropped and `(x += 1) - 1` where `x++`'s value is used;
  - where the component's code holds a shape React Compiler 1.0 cannot compile yet, its body
    starts with a comment naming it and `"use no memo";` (ADR-0045), and L3 fails an opt-out the
    compiler does not need (`react-compiler/needless-opt-out`);
  - a conditional's branches are keyed where a branch holds state a user can change (a control, a
    focusable element, a listener or a template ref, at any depth) and two branches can render an
    element of one tag at their top, through fragments, nested conditionals and list rows. Then
    every branch is keyed: a single element root takes `key={0}`, several roots or a list a keyed
    `<Fragment key={1}>`, a nested conditional that is a branch's only root keys its own branches
    under that branch's key (`key="1.0"`), and text alone nothing; two keyed conditionals among
    one parent's children start their keys with their position (`key="2-0"`). So React never
    carries an element, its focus or what was typed into it, into another branch.
- **Vue** is the reference (ADR-0014): the script copies the setup as written, and only the
  macros' and APIs' calls change (ADR-0048, ADR-0049). A state known to hold a primitive is a
  `ref`, any other a `shallowRef`, whose value is the source's own object, never a deep proxy: a
  state given a prop's item is that item, `structuredClone` copies it, and an emitted payload is
  what the source wrote. Vue's `watch` calls a shallow source back whenever its job runs, so a
  `shallowRef` source is watched through a getter (ADR-0048).
- **Vue and Svelte** tell a primitive by `isPrimitiveState` (`@unframework/codegen`): its type
  argument; or an initial value that is a primitive literal, a `.length` read, a call of a pure
  global whose result is a primitive (`Number`, `String`, `Math.*`, `JSON.stringify`,
  `Array.isArray`, …), a method whose result is a primitive on every built-in that has it
  (`trim`, `toFixed`, `join`, `includes`, `has`, …), a `computed` whose type, getter's return type
  or value is primitive, or a call of a setup function whose declared return type is primitive
  (not an async one). A global is the IR's `Global` reference, so a local named `Number` is not
  it.
- **Svelte** declares a state known to hold a primitive as `$state`, and anything else as
  `$state.raw`: state is replaced whole (ADR-0008), so the raw value is the source's own object,
  with its identity, and it is what a listener receives. A getter is `$derived(expr)`, or
  `$derived.by(() => {…})` for a block, an annotated return type or an async getter. Every initial
  value and constant that reads a prop, a state or a derived value outside a function is wrapped in
  `untrack(() => …)`, which says the snapshot is meant and keeps L3 free of
  `state_referenced_locally`. Reads and writes drop `.value` everywhere.
- **Solid** reads `count()`, writes `setCount(count() + props.step)` through `writtenValue`, and
  wraps what the setup reads once in `untrack` (`solid/reactivity`, L5). Signals apply a write at
  once and a memo recomputes as it is read, so a read after a write needs no mirror. Client code is
  copied as written, with no `batch`: the watchers coalesce, not the writes (ADR-0048). A function
  `solid/reactivity` would read as tracked (a promise continuation, a `queueMicrotask` callback,
  an array callback the rule does not take as synchronous, an arrow kept in a variable, an arrow a
  setup function hands to a local function) is said untracked, `untrack(() => …)`, where it reads
  a prop, state or a derived value; it runs outside any tracking scope, so `untrack` changes
  nothing but says so. A narrowed read is asserted: a state's or a derived value's call for a
  `local` or `closure` path (`selected()!`, `draft().email!`), a destructured prop's `props.x`
  only for a `closure` path, and a compound write's target (`setCount(count()! + step)`). A
  setter nothing calls is left out (`const [fixed] = createSignal(…)`).
- **Angular** declares members: state is `signal(x)`, `signal<T | undefined>(undefined)` for
  `ref<T>()`; a `computed` is `computed(…)`; a static constant a `readonly` field; a setup `let` a
  field. A value read while the class constructs cannot read an input, a `computed` or such a value
  (NG0950), so state and constants whose value reads one, itself or through what it calls, are
  `linkedSignal(() => untracked(() => …))` and `computed(() => untracked(() => …))`, each read once
  in `ngOnInit` under a comment, so a later rerender cannot change their first value. A setup `let`
  whose initial value reads one is declared `private x!: T;` and assigned in `ngOnInit`, in source
  order with them; its type is its annotation, or the type TypeScript gives the `let` where the
  value's text makes it certain (literals widened, operators by their operands, `??`, `?:`,
  `.length`, string, number and array methods, the pure globals' calls; `seeded.ts`), and only as a
  last resort `ReturnType<typeof this.initialX>` of a private method that computes it. A local
  function passed as a value is an arrow field, declared after the inputs, outputs, view queries and
  injected services and before the setup's own fields, so a field initialiser that calls it finds
  it. `=` is `set`; another write is `update((x) => …)` where its value reads only literals and the
  component's signals, and `set(this.x() + …)` where it reads a local or a field, whose narrowing
  `update`'s callback would lose. A narrowed read asserts its path in the class (`this.selected()!`,
  `this.draft().email!`). The template reads every signal it uses through a `@let` (ADR-0034), which
  Angular's checker narrows; a `track` reads `this.x()`. What the template uses is `protected`, what
  only the class uses `private`.
- **Qwik** uses `useSignal` and `useComputed$`, which recomputes synchronously on a write, and
  writes `.value` as the source does. A setup `let` is a `useSignal`, so every segment shares it. A
  `const` that reads a prop, a state or a derived value is `useConstant(() => …)`, evaluated once
  and untracked. A function that client code calls is a `$()` QRL: its call is awaited where it is
  a statement or its value is used as a plain value, which makes the caller `async`; a call of a
  function that returns a promise (`async`, annotated `Promise<…>`, or `return new Promise(…)`)
  is the QRL's promise, awaited only where the source awaits it (`ask().then(…)`, `void save()`).
  A function only render calls stays plain, and one both call has a QRL twin. A type predicate's
  or an assertion function's call is written in place, which keeps its narrowing (TS2776), and so
  is a synchronous helper whose value a task uses. A `computed` or a watcher that reads an
  optional prop absent at mount misses it once a parent adds it (`late-prop`, ADR-0048).
- **Astro** renders the initial state. A `ref` is a constant of its initial value, cast to the type
  `ref` gives it (`const count = 0 as number;`, `undefined as T | undefined` for `ref<T>()`), so a
  comparison with another value type-checks as in the source. A `computed` with an expression getter
  is a constant of its value; one with a block getter is a function `get<Name>()` and one call. What
  only client code reaches (listeners, template refs, watchers, hooks, setup `let`s, `emit`, and the
  state, functions, props and types only they read) is left out (`liveBindings`, `liveTypes`). A
  setup binding named `Astro` is declared under a claimed name (`Astro_1`), as the compiled
  component declares `Astro` in the frontmatter's scope.
- **Amendments to ADR-0036.** Solid's branches that read what their tests narrow take Solid's
  non-keyed callback, whose argument is an accessor:
  `<Show when={props.user}>{(user) => <p>{user().name}</p>}</Show>`, and `narrowed()` for an object
  of paths. A `when` that reads a signal passes the read to an arrow called at once, whose parameter
  TypeScript narrows (`when={((user) => (user !== null ? { user } : undefined))(user())}`); a test
  that can narrow nothing (the bindings it reads have no union or nullable type) prints the plain
  `when` and reads the binding as everywhere else; and a handler inside a narrowed branch reads the
  branch's accessor (`() => greet(owner().name)`). Solid calls the callback once while the test
  holds, so the branch keeps its DOM, focus and state when its value changes. A branch whose own
  expressions narrow the received value further (`user.nick ? user.nick.trim() : "none"`) stays
  keyed, with plain values, since TypeScript does not narrow a call: no corpus case has one. React
  keys a conditional's branches as above. Qwik needs neither: its optimizer keys every JSX node of a
  template, so the two branches' elements differ.

## Consequences

**Positive:**

- One component reads its own writes, keeps its setup values and replaces its branches' elements
  alike on six interactive targets, and Astro renders its initial state, checked by L6 to L9 on
  every `semantics/*` and `state/*` case.
- A narrowing the source's TypeScript makes holds in every output: the analyser marks it once,
  and each target asserts it only where its spelling loses it. Everyday nullish guards compile.
- React's outputs read as React code: one `useState` and one `useRef` per written state, no
  wrapper, and lint-clean under the React Compiler's rules.
- Vue and Svelte hand a listener the source's own object, as the setter-based targets do.
- Solid's branches update in place, as Vue's do, and keep focus.

**Negative:**

- React's outputs carry a mirror per written state, live getters, prop mirrors, client variants
  and a `useState` per function passed as a value, which a hand-written component often would not
  need; a component that opts out of React Compiler loses its memoisation.
- Angular's seeded state, constants and `let`s are `linkedSignal`s, `computed`s and definite
  fields read or assigned once in `ngOnInit`, which reads more indirectly than a field; a seeded
  `let` whose type its text does not fix is typed through a private method until M5's type oracle.
- Declared limits, each outside the corpus: Svelte's state and Solid's and Qwik's signals compare
  by `===` and `!==` where Vue's refs use `Object.is` (a `NaN` written over `NaN` renders again on
  Svelte and Solid, and `-0` over `0` does not); Qwik's `useConstant` evaluates again while its
  value is `null` or `undefined`; Solid applies each write to the DOM and its memos as it is made,
  so a template or a getter that throws on a state between two writes of one synchronous run
  aborts the run half-written, and a run that hides an element and shows it again creates it anew,
  without its focus, where Vue renders the run's last state only; Angular's development mode warns
  NG0956 when a keyed list of strings or numbers is replaced whole, though `track name` is the
  right key; Astro casts no `ref` of an expression whose literal type it cannot see
  (`ref(LIMIT)`), so a comparison outside its literal fails L4 on Astro only.
- UF3031 asks for a local where a TypeScript author would narrow a union's kind in place.

**Open:**

- Keyed lists that keep DOM identity on a reorder (plan M8), with their capability and case.
- A list's key that reads a narrowed value stays UF1002: Angular's `track` reads the prop again
  from its input. With the `narrowed` marks, Angular could assert it there.
- Solid 2 (R7), and a type oracle (M5) that could give Astro the widened type of any `ref`, and
  Angular every seeded `let`'s type.

## Alternatives considered

- **React: local shadows for a read after a write, snapshots and functional updaters** (plan §6's
  first sketch). They cover one function; a read in another listener of the same event, in a
  called function or after `await` needs the mirror anyway, and two mechanisms would disagree.
- **React: sync prop mirrors in `useEffect`.** A deferred continuation can run between the commit
  and the passive effects, and would read the old prop.
- **React: read every client value a branch's condition mentions as rendered** (the second
  build). A handler under `{page.value < pages.value && …}` that writes `page` and emits it read
  the rendered `page`, one behind; only the reads the analyser marks `template` need it.
- **React: compare branch positions one by one before keying** (the second build). React compares
  a single root with the first of several roots and positions inside fragments, which a
  position-by-position comparison missed; keying every branch where two can render one tag is
  exact.
- **Vue and Svelte: deep state for every value.** The proxy changes the identity and the payload of
  an object or an array, which `state/identity-and-clone`, `state/object-replacement` and
  `events/emit-payloads` compare, and `structuredClone` of it throws.
- **Solid: keep the keyed branches** (M1). A new value re-creates the branch's DOM and loses focus,
  which `semantics/deferred-reads`' delete and confirm buttons show. Accessor callbacks were M1's
  first design, set aside because TypeScript does not narrow a call; they return for every branch
  but those whose expressions narrow the value further.
- **Solid: `batch` the changes of each synchronous run** (the first and second builds). A lexical
  `batch` cannot reach past an `await`, a guard or a loop without a planner that grew a special
  case for each shape, and Solid's `batch` drops the pending updates of a callback that throws.
  The watchers' scheduler (ADR-0048) is exact for every run shape.
- **UF3031 for every narrowed read** (the first and second builds). It rejected
  `if (selected.value) emit("select", selected.value)`; an assertion is exact for a nullish
  narrowing, and only a narrowing to one kind of a union needs a local.
- **Angular: seed state in the constructor, or read inputs in field initialisers.** Inputs are not
  set there, which is plan §6's "inputs are read before they are set".
- **Qwik: a plain `let` and a plain `const`.** The `let` is copied into each segment that captures
  it, and the `const` follows the prop the optimizer reads live.
- **Astro: `const count = 0`.** TypeScript narrows a constant to its literal, so a comparison with
  another value (`count === 5`) fails `astro check` (TS2367) where the source's `Ref<number>` does
  not.

## Evidence

- `packages/analyzer/test/kinds-conformance.test.ts` "are what TypeScript infers for each binding":
  34 declarations through TypeScript 7.0.2's `tsc` (TypeScript 6 was the first plan; inference is
  the same for these declarations, and the analyser cannot reach the toolchains' TypeScript 6).
  `packages/analyzer/test/rules.test.ts`: "reports state and a setup `let` the outputs cannot type,
  and state holding a function", "accepts a type argument, an annotation or an initial value",
  "reports an annotated `let` without a value whose type leaves out `undefined`, `!` too" and
  "accepts an annotated `let` whose type admits `undefined`, or that has a value".
- Narrowed reads: `packages/analyzer/test/rules.test.ts` "marks a read that relies on a ref's
  value being present, in code and in a template expression's own conditional", "marks the
  everyday nullish narrowings: an emit's payload, a guard clause, a local, a result, an
  assignment, a literal", "marks nothing where no condition narrows a read, or its use takes it as
  it is", "marks a member path a condition narrows, of a ref's value, a prop and an array's
  element, level by level", "marks a destructured prop narrowed around a closure or by the
  template around a handler, never a ref's value across a closure", "marks a read that an
  assignment before it narrows, and nothing after another write or across a function", "marks a
  handler's read that the template's conditional around it narrows by kind" and "marks a compound
  write's target a condition narrows, where its operator reads it";
  `packages/ir/test/invariants.test.ts` "checkInvariants on narrowed reads";
  `packages/codegen/test/rewrite-code.test.ts` "reads a write's narrowed target as a narrowed
  read, which a target may assert (ADR-0046)".
- UF3031: `packages/analyzer/test/rules.test.ts` "reports a use that relies on narrowing a ref's
  union of kinds or of literals", "reports a use that relies on an assignment before it narrowing
  a union of kinds, with no fix", "accepts a union's uses that need no narrowing: un-narrowed,
  shared members, a parameter that takes every kind", "reports a narrowed union read into a local,
  returned or assigned, with the local before the guard", "puts the local before the outermost
  statement that narrows, once a block, and fixes nothing that writes or awaits" and "reports a
  prop whose union a condition narrows in a getter or client code, with the fix in an `if`";
  `packages/analyzer/test/code.test.ts` "narrows a ref's value in a conditional child, as a prop".
- React 19.3.0, @types/react 19.3.0, babel-plugin-react-compiler 1.0.0:
  `packages/target-react/test/setup.test.ts` "writes state through a mirror and its setter, and
  reads it there in client code", "memoizes a computed with every dependency, and reads it in client
  code through a live getter", "prints a computed's memo only where render code reads it, and its
  live getter only where client code calls it", "evaluates a setup const once, and hoists what
  captures nothing to module scope", "reads props and event props through mirrors in deferred code",
  "declares a function passed as a value once for the instance's life", "writes the logical
  assignments and captured updates React Compiler cannot lower", "writes an update of a captured
  variable inside an expression as an assignment of the same value", "keeps an update's value and
  precedence wherever it stands", "gives a function the template calls a client variant where client
  code reads otherwise", "asserts the narrowed reads its spelling does not narrow, and reads state a
  template's condition does not narrow through its mirror", "reads a value its branch narrows as the
  rendered value in a listener written there, so TypeScript narrows it as in the source", "keys the
  branches of a conditional that hold state, a single root by its key and several in a keyed
  fragment, and keyed siblings by their position" and "keys a nested conditional's branches under
  the enclosing branch's key where it is the branch's only root, and on their own inside a keyed
  fragment". `packages/target-react/test/behaviour.browser.test.ts` "reads a write in another
  listener of the same event and after a called function", "emits through the listener and with the
  props of the latest render after an await", "replaces a branch's element, as the other targets do,
  so focus leaves with it", "replaces a branch's element with a nested branch's, as the other
  targets do", "never carries an element or what was typed into another branch, wherever React would
  reconcile them", "passes the value its branch narrows, from the latest render, to a native
  listener there" and "reads a state a handler writes after its write, under a condition on that
  state that narrows nothing" (Vue's `moved 2, 3, 2, 0`). `packages/target-react/test/lint.test.ts`
  "rejects $what ($rule)" on "a mirror synced in render".
- Vue 3.5.43: `packages/target-vue/test/emit.test.ts` "declares %s as %s" (primitives as `ref`,
  objects, arrays, unions and typed calls as `shallowRef`) and "keys a template ref by its
  binding's name, prefixes an id, and writes effects with Vue's APIs";
  `packages/target-vue/test/behaviour.browser.test.ts` "reads a ref and a computed right after
  writing in one handler" and "holds the source's own object: identity with a prop's item, and
  structuredClone" (with `ref`, identity fails); `packages/target-vue/test/lint.test.ts` "rejects
  $what ($rule)" on "a ref used as an operand in the script" (`vue/no-ref-as-operand`).
- Svelte 5.57.1: `packages/target-svelte/test/emit.test.ts` "declares %s as %s" (`$state` and
  `$state.raw`, the call and built-in rows included) and "reads props and state at the top of the
  script once, through untrack"; `packages/target-svelte/test/behaviour.browser.test.ts` "seeds
  state from a prop once, reads it right after a write, and emits";
  `packages/target-svelte/test/props.browser.test.ts` "hands the caller's own objects, which
  structuredClone copies". A bare `$state(initial)` warns `state_referenced_locally` three times,
  a probe's finding. A `$state` write is compared with `===` (`equals` in Svelte's
  `internal/client/reactivity/equality.js`), as its source reads.
- Solid 1.9.15, eslint-plugin-solid 0.18.0: `packages/target-solid/test/setup.test.ts` "spells
  state, derived values, template refs, ids, constants and lets", "copies client code as written,
  with no batch, whatever its runs", "asserts a read a condition narrows where Solid's spelling
  loses it, and only there", "asserts a compound write's target a condition narrows, as its operator
  reads it", "says untracked what `solid/reactivity` would track: continuations, assigned arrows,
  callbacks" and "says untracked an arrow a setup function hands to a function, never one a handler
  or a callback does"; `packages/target-solid/test/lint.test.ts` "rejects $what ($rule)" on "a prop
  the setup reads once outside `untrack`", "a setter no code calls", "a promise continuation that
  reads a signal outside `untrack`" and "an arrow a setup function hands to a function, reading a
  signal outside `untrack`"; `packages/target-solid/test/behaviour.browser.test.ts` "calls a watcher
  back once per synchronous run of every shape, as Vue does". In Node, a Solid render of
  `items()[index()].toUpperCase()` throws at the first of two writes that shrink the list and move
  the index, where Vue renders the run's last state, a probe's finding.
- Solid's branches: `packages/target-solid/test/emit.test.ts` "gives a branch the value its one
  test holds, through the callback's accessor", "reads a value plainly where no test can narrow
  it: a comparison, a type with no union", "reads state plainly where its type has no union, from
  its argument or initial value" and "keys a branch whose expressions narrow its value further,
  nested ones and lists included"; `packages/target-solid/test/rewrites.browser.test.ts` "updates
  the branches that narrow, as their references come and go";
  `packages/target-solid/test/behaviour.browser.test.ts` "narrows state in a branch and reads a
  branch's value in its handler".
- Angular 22.2.1: `packages/target-angular/test/setup.test.ts` "seeds from inputs lazily, and
  reads what was seeded once in ngOnInit", "writes through `set` and `update`, and a setup `let`
  as a field", "declares each with its type, definitely assigned in ngOnInit, in source order",
  "types operators, `.length`, string and array methods and pure globals by their operands",
  "declares a function passed as a value before the fields whose initialisers call it", "assert
  the path present where the class reads it through a call, and the template needs none", "set a
  current value they narrow, which `update`'s parameter would not be" and "keep the narrowing of a
  write's value: `update`'s callback only for literals and signals";
  `packages/target-angular/test/state.browser.test.ts` "reads each write at once: in the handler,
  in a function it calls, in a loop", "gives a listener of the same event what the capture
  listener wrote", "reads a computed consistently right after a write of what it reads", "keeps
  state seeded from an input when the input changes", "keeps a constant that read an input, while
  the template reads the input anew", "reads the latest state and inputs after an await", "start
  from the inputs the component was given, and keep those values", "take an optional input's
  default when it is absent", "are there when an initial value calls them, before their
  declaration" and "run as the source's, only where the condition holds".
- Angular's development-mode NG0956 for `@for (name of names; track name)` replaced whole comes
  from `@angular/core`'s `ɵɵrepeater` when the track function is `ɵɵrepeaterTrackByIdentity`,
  which `@angular/compiler` 22.2.1's `optimizeTrackFns` makes of `track name`, a probe's finding.
- Qwik 2.0.0-beta.47: `packages/target-qwik/test/setup.test.ts` "writes ref as useSignal, computed
  as useComputed$, a setup let as a signal", "moves what captures nothing to module scope, and keeps
  a constant reading a prop once", "makes a function client code calls a $() QRL, awaits its calls
  and makes callers async", "keeps a call of a function that returns a promise as the promise,
  awaited only where the source awaits it", "keeps a function render calls plain, with a QRL twin
  for client code" and "writes the calls of a type predicate and an assertion function in place,
  keeping their narrowing"; `packages/target-qwik/test/behaviour.browser.test.ts` "reads its own
  writes, a called function's, a derived value's, and after await" and "narrows through a type
  predicate and an assertion function". Qwik's `useConstant` returns its stored value only
  `if (val != null)` (`dist/core.mjs`), a reading of the source.
- Astro 7.3.5: `packages/target-astro/test/setup.test.ts` "declares a `ref` as its initial value,
  cast to the type the `ref` has", "widens a conditional of literals as `ref` does, and keeps the
  union a `computed` keeps", "declares a `computed` as its value: an expression, or a block getter's
  function, called once", "copies the constants and functions the server render calls, and drops the
  others", "drops listeners, template refs, watchers, effects, hooks, `let`s, `emit` and what only
  they reach", "reads a props object named `Astro` as `props`, and renames a setup binding named
  `Astro`" and "passes Astro's compiler, astro check and the linters with no finding (formatted:
  %s)". `const count = 0;` beside `{count === 5 ? … }` fails `astro check` with TS2367 under
  TypeScript 6.0.2, a probe's finding.
- The corpus cases `state/counter`, `state/object-replacement`, `state/array-replacement`,
  `state/computed-chain`, `state/local-functions`, `state/identity-and-clone`,
  `state/toggle-in-branch`, `state/narrowed-reads`, `state/derived-arrays`,
  `state/react-compiler-shapes`, `semantics/read-after-write`, `semantics/derived-consistency`,
  `semantics/setup-once`, `semantics/props-seed-state`, `semantics/props-seed-let`,
  `semantics/derived-from-props`, `semantics/deferred-reads` and `semantics/nested-branches` are
  green at every live layer on all seven targets; their interactive tests are skipped on Astro by
  capability, and L6 checks its initial render.
