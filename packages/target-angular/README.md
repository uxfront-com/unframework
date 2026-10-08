# @unframework/target-angular

The Angular 22 target of the Unframework compiler: standalone, zoneless components with inline
templates, whose host element has `display: contents` (decision D6, ADR-0010).

## Output

One `<kebab-name>.ts` file per component (plan §6), in this order: the imports from
`@angular/core` (and `isPlatformBrowser` from `@angular/common`), each under a name no source name
takes; the type declarations; `let nextId = 0;` when the component makes ids; the directives its
listeners' options need; the component.

- **Types.** The source's type declarations the output reads (its inputs' and outputs' types, the
  setup's annotations and code) and every exported one, copied as written and exported as the
  source exports them. An input is typed by its member's type, never by the props type, so a
  props type the source does not export is left out (it would be declared and never used).
- **Inputs.** Every prop is a public signal input, whether the template reads it or not (a
  prop is the component's API, and Angular reports a value for an undeclared input):
  `input.required<T>()` when required, `input<T>()` when optional, and
  `input<T, T | undefined>(default, { transform })` with a default, whose transform is
  `(value) => (value === undefined ? default : value)`: an explicit `undefined` takes the
  default, as JavaScript's destructuring does, and `null` stays a value.
- **Outputs.** Every event `defineEmits` declares is a public `output()` of its name (ADR-0012):
  an `output()` emits one value, so the payload is nothing for an event without members
  (`output<void>()`, `emit()`), the value for one required member (`output<number>()`), and the
  named tuple of exactly the arguments given otherwise (`output<[path: string, note?: string]>()`,
  `emit([path])`), which the mount adapter spreads back (ADR-0047). The output keeps the event's
  name, which is the component's API, also where a setup binding has it (`function save() {
emit("save") }`): the class's own member takes another name instead (`src/plan.ts`,
  `withOutputNames`), `onSave` for a local function, `fieldElement` for a template ref and
  `currentPage` for any other value, since angular-eslint's `no-output-rename` rejects an alias.
- **Template.** One `@let name = this.name();` per signal the template reads (an input, a
  state, a derived value, a setup-once constant: props first, then the setup's in source order),
  then the markup of the Angular dialect (`@unframework/codegen`'s `angularDialect`): `{{ }}`,
  `@if`/`@for`, `[attr.x]` bindings, a static `class` beside one `[class]`, a static `style`
  beside `[style.x]`, `#name` for a template ref. The template reads signals through those
  variables because Angular's type checker narrows a template variable as TypeScript narrows a
  local, but never a signal call, so every expression type-checks as it does in the source. A
  `track` expression may read only its item, `$index` and the component's members, so a signal
  a key reads is read there as `this.label()`. Constants, ids and methods are members, read by
  name.
- **Members.** Each allowed global the template reads (`Math`, `String`) is a `protected
readonly` member of the same name: a template sees only its component's members. A member the
  template uses is `protected`; one only the class uses is `private`.
- **Names.** Angular's compiler accepts a signal input only in a class whose decorator is
  imported as `Component`, so a component named `Component` takes the class name `Component_1`
  and is exported under its own; an import a source name takes is imported under another name
  (`input as input_1`).

### The setup (ADR-0045 to ADR-0049)

The class declares the setup's bindings as members, in source order (`src/members.ts`); class
code reads each through `this.` (`src/rules.ts`): a signal by calling it, a template ref's
element as `this.field()?.nativeElement`. The source's template ref value is `T | null`, so a read
that keeps, passes, returns or compares the element is `this.field()?.nativeElement ?? null`; one
that only tests it, asserts it or reads through it (`.focus()`) needs no `?? null`.

TypeScript narrows a ref's value and a prop where a condition shows it present (`if
(selected.value) emit("select", selected.value)`), but never a call, which is how the class reads
both. So each read the analyser marks narrowed (`BindingReference.narrowed`, ADR-0046) asserts its
path present (`src/narrowing.ts`): `this.selected()!`, `this.draft().email!` for a member path,
and `this.field()!.nativeElement` for a template ref (inside `?.nativeElement` the assertion would
leave the chain optional). A template statement asserts a state's read so too (`this.selected()!`);
the template itself, which reads through `@let`, and a template statement's input need none.

| Source                              | Angular output                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `const count = ref(0)`              | `signal(0)`; `ref<T>()` is `signal<T \| undefined>(undefined)`                                                                 |
| `ref(initial)` reading an input     | `linkedSignal(() => untracked(() => this.initial()))`, read once in `ngOnInit`                                                 |
| `count.value = x`, `count.value++`  | `this.count.set(x)`, `this.count.update((count) => count + 1)`; `+= value` reading a local or a field: `set(this.count() + …)` |
| `const total = computed(() => …)`   | `computed(() => …)`                                                                                                            |
| `const label = …` reading an input  | `computed(() => untracked(() => …))`, read once in `ngOnInit` (setup-once)                                                     |
| `const rates = …`                   | a `readonly` field                                                                                                             |
| `let timer: T`                      | a field: `private timer: T \| undefined;`, `private refreshes = 0;`                                                            |
| `let remaining = limit` (an input)  | `private remaining!: number;`, assigned in `ngOnInit` (below)                                                                  |
| `const input = useTemplateRef<T>()` | `viewChild<ElementRef<T>>("input")`, with `#input` on the element                                                              |
| `const id = useId()`                | `` `uf-id-<component>-${nextId++}` ``: a module counter (emulated, `use-id`)                                                   |
| `function save()`, arrow `const`    | a method; one passed as a value (`setTimeout(tick, 100)`) an arrow field, which keeps `this`, declared before the other fields |
| `emit("change", value)`             | `this.change.emit(value)`, by the payload rule                                                                                 |
| `nextTick()`                        | `this.nextTick()`, a private method that renders in a microtask with `ApplicationRef.tick()` (emulated, `next-tick`)           |
| `watch(source, callback, options)`  | an `effect()` created in `ngOnInit`; `afterRenderEffect()` with `flush: "post"` (below)                                        |
| `watchEffect(effect)`               | `afterRenderEffect(effect)` in the constructor: after the render, in the browser only                                          |
| `onMounted(callback)`               | `afterNextRender(callback)` in the constructor: in the browser, once the view is in the document                               |
| `onUnmounted(callback)`             | in `ngOnDestroy`, in the browser only                                                                                          |

A watcher is created in `ngOnInit`, once the inputs are set, so the source's value at creation is
known and typed: `let lastCount = currentCount();`. Its source goes through a `computed`
(`const currentCount = computed(() => this.count())`), whose value changes only when it differs
(`Object.is`; an array of sources compares each element), so the effect runs again only when the
source changed, and Angular's `onCleanup` runs only before the next callback and on destruction,
as Vue's does. An input or a `computed` is watched as it is. The effect's first run only records
the value (`if (Object.is(value, lastCount)) return;`), or, with `immediate`, runs the callback
in the browser (`if (!isPlatformBrowser(this.platformId)) return;`). The callback runs
`untracked`; an async callback is `untracked(async () => …)`, whose promise nothing awaits. An
array of sources is `computed(() => [a, b] satisfies [unknown, unknown], …)`, one new array only
when a source changed, compared by identity: `satisfies` types the literal as a mutable tuple
(`[number, string]`), so the callback reads, destructures and passes on its values as Vue types
them, and gets the last array again as its previous values, as Vue hands it. An immediate
watcher's first previous values are `[]`, typed as Vue types them, each value or `undefined`
(`as [(typeof lastValues)[0] | undefined, …]`). An async `watchEffect`
runs as a floating async function inside the effect (`void (async () => { … })();`), so its reads
before its first `await` are tracked. Effects run during change detection, which zoneless Angular
schedules as a macrotask: the writes of one handler run a watcher once, and writes on both sides of
an `await` may run it once or twice (the semantics contract allows both).

A field initialiser runs while the class constructs, before Angular sets any input. So a setup
`let` whose initial value reads an input, a seeded state or constant, a derived value or another
such `let` is declared without one and assigned in `ngOnInit`, in source order with the seeded
values: `private remaining!: number;` and `this.remaining = this.limit();`, definitely assigned
(`!`) whatever its type, since `ngOnInit` assigns it before any code reads it. Its type is its
annotation, or the type TypeScript gives the `let` where the value's text makes it certain
(`src/seeded.ts`: literals widened, operators by their operands as in `step * 2`,
`note ?? "none"` and `a ? "x" : "y"`, `.length`, the string, number and array methods whose
result the receiver fixes, the pure globals' results, and reads of a prop or of a member whose
type is known so); otherwise, as a last resort, a private method computes the value, and the field
is typed by it (`ReturnType<typeof this.initialFound>`), since no type oracle exists before M5.

A local function code passes as a value is an arrow field, declared before every other field of
the setup: a field initialiser runs while the class constructs, in field order, and an initial
value that calls a function which passes it on (`names.toSorted(compare)`) finds it there, as the
source finds its hoisted function.

Angular destroys a component's outputs before its view effects and its `DestroyRef` callbacks
(an emit then is NG0953 and lost), while Vue stops a watcher and runs `onUnmounted` while the
component still emits. So a watcher or a `watchEffect` with an `onCleanup` keeps its
`EffectRef`/`AfterRenderRef` in a member, and `ngOnDestroy`, which runs first, destroys it
(running the cleanup), then runs the `onUnmounted` callbacks, each in turn: one whose body
returns runs in a function of its own (`(() => { … })();`), so its `return` ends it and not
`ngOnDestroy`. A callback the class runs (a hook, an effect, a watcher's) returns no value, as
none is read: its `return x;` keeps only what `x` changes.

### Listeners (ADR-0047)

Angular's template statements are not JavaScript functions (no block bodies, no `++`, a signal
is written through `set`), so a listener is (`src/listeners.ts`):

- `(click)="save()"`, `(keydown)="recordKey($event)"`: a setup function by name, with `$event`
  when its first parameter is the event.
- `(click)="select(task.id)"`, `(click)="share.emit([path])"`: an inline handler that is one call
  of a setup function or of `emit`, with arguments the template reads as the source does
  (literals, inputs, constants, a list's item and index, the event as `$event`). A handler that
  reads a list's item is always one (UF3029): the `@for` declares and types the item. So is one
  that reads a prop a condition around it tests, when Angular's expressions can hold its
  arguments (`record('thank ' + organiser.name)`, `save({ ...owner, name: owner.name })`, as
  Angular 22 reads spreads): the template keeps the prop narrowed. A state
  an argument reads is read from the class (`this.selected()`), and declares no `@let`.
- In both, a call of a function that may return a value drops it (`void toggle()`,
  `void moveFrom(row, $event)`): Angular calls `preventDefault()` when a listener's value is
  `false`, and every other target drops a handler's value.
- `(click)="onAddOne()"`: any other inline handler moves to a `protected` method named `on` and
  what its element says it is (its static `aria-label` or its text, for a click; a form
  control's `name` and the event; or the event alone), its event parameter annotated with its
  event's DOM interface when the source leaves it to the JSX types. The method returns nothing:
  an expression body becomes a statement (`a && b()` is `if (a) b();`, `a || b()` is
  `if (!a) b();`, `c ? x() : y()` an `if`/`else`), and a block body's `return false;` is
  `return;`, `return save();` is `this.save(); return;` (a value would prevent the event, and a
  value on some paths only fails `noImplicitReturns`). Only what changes something stays
  (`src/statements.ts`): a read of a signal (`this.count()`) is no change, so `return
count.value > 0;` is `return;`, and a branch or a side that changes nothing goes (`c ? save() :
false` is `if (c) this.save();`).
- `(ufClickCapture)="record('capture')"`: a listener with an option. Templates have no syntax for
  one, so the file declares an exported attribute directive per event and option
  (`[ufClickCapture]`, `[ufClickOnce]`, `[ufWheelPassive]`, emulated), which listens to its element
  through `Renderer2.listen(element, "click", …, { capture: true })`, re-emits the event through an
  output of its selector's name, and stops listening when its element goes. Being a directive, it
  works in `@if` and `@for` blocks; Angular's template type checker imports it (NG3004 for one
  that is not exported).
- `(click)="bump(); void (once(clickOnce, $event) && started.emit(count))"`: the listeners of one
  element and event in the bubble phase, when there are two or three (a plain one beside a
  `once` or a `passive` one). A directive listens when its element is created, before the
  template's own listeners, so they would not run in their attributes' order: one template
  listener chains their statements in that order, each written as it would be alone, so the
  template keeps typing a list's item and narrowing what a condition narrows. A `once` listener
  runs under a guard, `once(clickOnce, $event) && …`: a `protected` method that marks the element
  in a `WeakSet<EventTarget>` per event and tells whether it ran there before, as `{ once: true }`
  removes a listener from its own element only (each row of a list runs its own once). A
  `passive` listener joins them: the element has a listener that is not passive, so scrolling
  waits either way (the analyser rejects `preventDefault()` in a passive listener). The chain's
  last statement is `void` when it may have a value. Within one listener, an async listener's
  continuation runs after the later listeners' synchronous code, where the browser may run it
  between two listeners of a person's input; an error thrown by one stops the later ones.
- An event named after a JavaScript reserved word (`delete`) is emitted from a template statement
  through `this.` (`this.delete.emit(id)`), which reads it as a member.

Handlers run synchronously during dispatch, so `preventDefault()` and `stopPropagation()` work as
written; listeners keep DOM semantics (`change` on commit, `focus` and `blur` without bubbling).

### Capabilities

Native: everything but `event-capture`, `event-once` and `event-passive` (emulated, the directives
above, helper `uf<Event><Option>`), `use-id` (emulated, `nextId`) and `next-tick` (emulated,
`nextTick`).

## Toolchain

Tests and tooling build, check and run the Angular output through three subpaths:

- `@unframework/target-angular/toolchain` (Node): the `toolchain` the harness drives.
  - `vite("browser" | "ssr", context)`: Angular's AOT compiler (ngtsc, strict templates) for
    the unframework plugin's virtual `X.uf.tsx.ts` modules, Analog with `jit: false`, and the
    Angular linker, over the pre-bundled framework in the browser and over the packages the SSR
    module graph inlines on the server, so no JIT compiler runs.
  - `frameworkCompile(files, context)` (L3) and `typecheck(files, context)` (L4): one ngtsc
    program over every file, reported per file.
  - `lint(files, context)` (L5, ADR-0042): oxlint's shared baseline over the TypeScript, and
    ESLint with angular-eslint over the file and its inline template.
    `@angular-eslint/no-output-native` is off: it judges the author's event names (ADR-0047).
- `@unframework/target-angular/toolchain/client`: the browser mount adapter (`createApplication`
  and `createComponent`, zoneless, settled with `whenStable`). `rerender(props)` sets each new
  prop with `setInput`, and `setInput(name, undefined)` for a prop the new props leave out,
  since Angular cannot unset an input (ADR-0043). The test's listeners are bound to the outputs
  of their events' names (`outputBinding`), and each payload is given back by its event's shape.
- `@unframework/target-angular/toolchain/server`: the SSR renderer (`renderApplication`), which
  returns the component's HTML only. It runs on the `ssr` Vite configuration, which links
  Angular's packages as they load.

Angular's compiler stack runs on TypeScript 6, while this repository runs TypeScript 7, so it is
never a dependency of this package. The toolchain loads `@angular/compiler-cli`, `@angular/build`,
`@analogjs/vite-plugin-angular` and TypeScript 6 from `context.toolchainDir`, which must have
them in its `node_modules` (in this repository, `tests/toolchains/angular`), together with a
`tsconfig.json` for the type check.

## Tests

`pnpm test` runs three projects: `unit` (Node: the emitter, L3 to L5 over the corpus and
`test/lint-probes.ts`'s shapes, the adapter on domino), `ssr` (the server renderer on the SSR
configuration, effects kept off the server) and `browser` (Chromium: the corpus's components as
this target emits them now, served by `test/corpus-plugin.ts` and mounted by the adapter, judged
on the semantics contract: reads after writes, watch timing, previous values and cleanups,
lifecycle, listener options, emits).
