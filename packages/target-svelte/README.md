# @unframework/target-svelte

The Svelte 5 target of the Unframework compiler: runes-mode components. Every component
declares `<svelte:options runes={true} preserveWhitespace={false} />`, so one without runes never
compiles in legacy mode and the markup's layout holds whatever the consumer's whitespace option.

A component is that line, a module script when it exports a type or declares injection keys, an
instance script when it takes props or has a setup, and its markup (plan §6):

```svelte
<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BadgeProps {
    label: string;
    tone?: "info" | "warn";
  }
</script>

<script lang="ts">
  let { label, tone = "info" }: BadgeProps = $props();
</script>

<p class={["badge", `badge-${tone}`]}>{label}</p>
```

- **Props** (ADR-0034). The script copies the type declarations the props reach, as written
  (exported where the source exports them), and reads the props with `$props()`: a destructured
  pattern in source order with the defaults as written, or the source's props object
  (`let props: CardProps = $props()`, read as `props.title`). A destructured prop that no
  expression reads is left out; a component that reads none declares `let _props: P` (an empty
  pattern is `no-empty-pattern`, and the `_` keeps `no-unused-vars` off an object nothing reads),
  as does the object form (`_` and its name). A props object whose name Svelte reserves
  (`$`-prefixed) is named `props`. Script lines are indented, but for lines inside a multi-line
  literal, which the target finds by parsing the code. `</script` in copied code is written
  `<\/script`, as a guard: the analyser rejects it.
- **Types** (ADR-0067, ADR-0068). The types a component reads from another file are imported by
  name, under the source's names: a `.ts` module's or a package's from the specifier as written,
  `import type { Tone } from "./types"`, and a child's from its output, beside the child,
  `import Field, { type FieldProps } from "./Field.svelte"`. The output of the module's main
  component also writes the module's type exports: an exported type no component reaches, and a
  re-export, `export type { Tone } from "./types"`. An output that exports a type declares the
  types it copies and imports in `<script lang="ts" module>`, which the instance script reads, so
  a consumer imports them from the component's file:
  `import type { BadgeProps } from "./Badge.svelte"`. A generic component writes its type
  parameters in the instance script's `generics`, `<script lang="ts" generics="T extends string">`.
  An attribute cannot hold its own quote, so every string literal in them is double-quoted, a
  template literal stays in backticks, a `'` inside either is written `\u0027`, the same type, and
  the attribute is single-quoted where the text holds a `"`:
  `generics='T extends "don\u0027t" | "b"'`. A scoped slot's props that name a type
  parameter are `Snippet<[{ item: T }]>`; both cells are native.
- **Shared modules** (ADR-0070). A value the component reads of a `.ts` module is imported as the
  source imports it, `import { sizes } from "./tokens"`, from the copy beside the outputs. The
  module's constants it reads, and those they read, are declared as written at the top of the
  instance script, before `$props()`, with the types they name: `const GAP = sizes.sm * 2;`. The
  instance script is one scope with the setup, so a module name a top-level setup binding shadows
  is declared under a name of its own, and the constants and copied types that read it read it
  there (`src/modules.ts`).
- **Composables** (ADR-0069). A `.uf.ts` module's composable is its own module,
  `useToggle.svelte.ts`, whose runes vite-plugin-svelte compiles: the source's exported function,
  its parameters and type parameters as written, its setup as a component's (below), and an
  object of getters for each ref and computed value it returns, with its functions and constants
  as they are, since a destructured rune would hold its value once:
  `return { get on() { return on; }, toggle };`. A caller imports it as
  `import { useToggle } from "./useToggle.svelte"`, which svelte-check and the unplugin resolve to
  that module, and keeps the object: `const toggle = useToggle(false)`, read as `toggle.on` and
  `toggle.toggle()` in the script and the markup. The object takes the one member's name where the
  call renames it (`const wide = useMediaQuery(…)` for `{ matches: wide }`), or the composable's
  (`toggle` for `useToggle`), which may be a member's, since UF3024 keeps every other name off it.
  A getter and a callback are passed as written. Both cells, `composables` and
  `composable-effect-order`, are native: the composable's effects and hooks run where its call
  sits.
- **Setup** (ADR-0045 to ADR-0049), in source order after `$props()`, with what it imports from
  `svelte` and `svelte/events` (each name claimed beside the source's):

  | Source                                                    | Svelte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `const count = ref(0)`                                    | `let count = $state(0)`; `$state.raw(…)` for anything not known to be a primitive (`isPrimitiveState` from `@unframework/codegen`): state is replaced whole (ADR-0008), and a raw value is the source's own object                                                                                                                                                                                                                                                                                                                                                                                                                                |
  | `count.value`, `count.value += 1`                         | `count`, `count += 1`, in the script and the markup alike                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | a setup value reading a prop, a state or a computed value | wrapped in `untrack(() => …)`, the snapshot `state_referenced_locally` asks for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
  | `computed(() => e)`                                       | `$derived(e)`; `$derived.by(() => {…})` for a block getter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | `useTemplateRef<T>()`, `ref={el}`                         | `let el: T \| null = null` and `bind:this={el}`, which sets `null` when the element goes; `$state<T \| null>(null)` when a condition renders the element                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
  | `useId()`                                                 | `const uid = $props.id();` once, then `` `uf-id-${uid}-0` ``, `` `uf-id-${uid}-1` ``, …: every id has a suffix, so `${id}-${n}` of one never spells another                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `const`, `let`, `function`                                | as written                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | `watch(source, cb, options)`                              | `$effect.pre` (or `$effect` for `flush: "post"`) that reads the sources, calls back in `untrack` only when one changed by `Object.is`, with the previous value it recorded; a getter through a `$derived`; `onCleanup` runs before the next call and, through `onMount`, at unmount; an array source's values are the mutable tuple Vue hands the callback (`[typeof a, typeof b]`), never `as const`; the previous value starts as the sources' own, read in a function (`untrack((): [typeof a, typeof b] => [a, b])`), since a type query at the top of the script reads a state as its initial value narrows it (`false` for `$state(false)`) |
  | `watchEffect(fn)`                                         | `$effect`, its `onCleanup` the function it returns; an async body runs as an async function the effect starts, `$effect(() => { void (async () => {…})(); })`, so the part before its first `await` is tracked                                                                                                                                                                                                                                                                                                                                                                                                                                    |
  | `onMounted(fn)`, `onUnmounted(fn)`                        | `onMount(() => {…})`, `onMount(() => () => {…})`: browser only, never `onDestroy`; an `onUnmounted` declared before a watcher or a `watchEffect` with a cleanup comes after the last of them, so every cleanup runs before it, as on Vue (Svelte tears effects down in creation order)                                                                                                                                                                                                                                                                                                                                                            |
  | `nextTick()`                                              | `tick()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
  | `defineEmits`, `emit("change", v)`                        | a callback prop `onchange` (the name in lower case) in `type Props = <props type> & { onchange?: (value: number) => void }`, destructured where called: `onchange?.(v)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `const { on, toggle } = useToggle(false)`                 | `const toggle = useToggle(false)`, each name read through the object: `toggle.on`, `toggle.toggle()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

- **Listeners** (ADR-0047). `onclick={…}` and `onclickcapture={…}`, the handler a setup function's
  name or an arrow. Svelte has no attribute for `once` or `passive`, for the events
  `svelte/elements` does not type (`animationcancel`, `command`, `securitypolicyviolation`), nor
  for a non-passive `touchstart`/`touchmove` (its attribute listens passively): those listen
  through `on` from `svelte/events` in an attachment, with `addEventListener`'s options
  (`{@attach (node) => on(node, "wheel", zoom, { passive: true })}`), and so does every bubbling
  listener of an event another listener of the element listens to that way, which keeps their
  order. A `once` listener's handler goes through `once`, an inline wrapper whose guard is set
  when the handler first runs (`{@attach (node) => on(node, "click", once(save))}`), never
  `{ once: true }`: `on` runs the handlers Svelte delegated below its element inside its own
  listener, so the option would be used up by an event one of them stopped. A handler's event
  parameter annotated with lib.dom's interface where Svelte hands another (`InputEvent` on
  `oninput`, which gives an `Event`) takes the nearest interface both extend; one annotated with
  a union (`MouseEvent | KeyboardEvent`) keeps it where each event it receives extends a member,
  and takes the nearest interface they all extend where one does not (`src/handlers.ts`,
  `src/events.ts`). Every capability is native but `event-once`, emulated by
  `once`, and `style-binding`, emulated by `styleText`, which writes a style bound to an object as
  a declaration list (ADR-0065): `event-capture`, `event-passive`, `event-semantics`, `use-id`,
  `next-tick` included.
  Of composition's cells, `fallthrough` (`mergeStyle`), `model-modifiers` (`modelText`) and
  `reactive-context` (`refObject`) are emulated, and the others native; of styling's,
  `child-root-scope` (`scopeAttributes`) is emulated.
- **Composition** (ADR-0053 to ADR-0055), with what it imports beside `svelte`:

  | Source                                              | Svelte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `import Field from "./Field.uf.tsx"`, `<Field />`   | `import Field from "./Field.svelte"`, each child a sibling file's default export; a component that renders itself imports its own file, as Svelte 5 writes recursion                                                                                                                                                                                                                                                                                                                                                             |
  | `label="Name"`, `tone={tone.value}`, `onClear={f}`  | `label="Name"`, `{tone}`, `onclear={f}`: the child's callback prop                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
  | `defineSlots<{ default?(); item?(p: P) }>()`        | `children?: Snippet` and `item?: Snippet<[P]>` in the props type, destructured where the component reads them (`item: itemSnippet` where a source name such as a list's `item` would be captured)                                                                                                                                                                                                                                                                                                                                |
  | `{slots.item?.({ item })}`, `?? fallback`, presence | `{@render item?.({ item })}`, `{#if item}{@render item()}{:else}…{/if}`, `item`                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
  | a fill, a scoped fill, a forwarded slot             | the default slot's content between the tags; `{#snippet title()}…{/snippet}`, `{#snippet item({ item })}…{/snippet}`; `{title}`, the parent's own snippet, absent where the parent got none; a parent binding named like a slot it fills takes a name of its own (`header: header_1`), as the snippet would hide it                                                                                                                                                                                                              |
  | `defineModel<number>("value", { default: 0 })`      | `value = $bindable(0)`, `value?: number`; a parent binds it with `bind:value={count}`, and an unbound one is local                                                                                                                                                                                                                                                                                                                                                                                                               |
  | `v-model` on a control                              | `bind:value` (a text field, a `<textarea>`, a `<select>`), `bind:checked` (a checkbox), `bind:group` (checkboxes into an array, radios); a number or range input and a modifier through the inline `modelText` attachment, Vue's `vModelText`, with `value={untrack(() => x)}` for the server's and the first render's value                                                                                                                                                                                                     |
  | fallthrough `class` and `style`                     | `class?: ClassValue` and `style?: string` props of a component whose root is one element or one component, merged into it: `class={["tag", className]}`, and `{style}` alone or `style={mergeStyle({ padding: "2px" }, style)}` beside a style of the root's own, where the inline `mergeStyle` drops the root's declaration of a property the consumer sets to a nullish value (written `color: `) and passes the empty declaration on, as an object merge does; passed on to a root component; none with `inheritAttrs: false` |
  | `defineExpose({ focus })`, `ref={field}`            | `export function focus`, `bind:this={field}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `InjectionKey`, `provide`, `inject(Key, fallback)`  | `export const Key = Symbol("…") as symbol & { readonly __value: T }` in the `<script lang="ts" module>` of the module's main component, with the types it copies; `setContext(Key, value)`; `hasContext(Key) ? getContext<(typeof Key)["__value"]>(Key) : fallback`, a consumer importing only the key; a provided ref as the inline `refObject(() => count)`, whose `value` reads it                                                                                                                                            |
  | `<component is={…}>`                                | `<svelte:element this={…}>` over tags; over components, `const Component = $derived(…)` and `<Component />`, or, where the condition reads a list's item or a fill's parameter, `{#if …}<Chip />{:else}<Card />{/if}` where it sits                                                                                                                                                                                                                                                                                              |

- **Styles** (ADR-0063). A component with a stylesheet imports the sheet `compile()` scoped,
  `import "./Card.uf.tsx.css";`, after its other imports: Svelte's own `<style>` is never
  used, since it drops the selectors it cannot match. Every element of its markup carries
  `data-uf-<id>=""`. A child's tag takes the parent's attribute in an object spread,
  `<Button {...{ "data-uf-a33d603f": "" }} />`, since svelte-check rejects a prop the child does
  not declare, and the child's root spreads the `data-uf-*` props of its styled parents, picked
  out of `$props()` by an inline helper, `{...scopeAttributes(attributes)}` (`child-root-scope`,
  emulated), on each node Vue's fallthrough reaches. The imports of sibling outputs are sorted by
  specifier, as the other targets sort theirs, so the children's sheets load, and cascade, in
  Vue's order. Content filled into a child whose sheet
  uses `:slotted()`, a snippet's included, carries the child's `-s`, and the fill of a
  `<component is>` that of each candidate.
- **Markup** (`svelteDialect` in `@unframework/codegen`). `{expr}`, `{#if}{:else if}{:else}{/if}`,
  `{#each source as item, index (key)}…{/each}` (the index only when an expression reads it),
  `name={expr}`, and Svelte's shorthands where the value is the variable of the same name
  (`{href}`, `style:color`). An attribute Svelte's element types declare on other elements only
  (`autocorrect` outside `<input>`) is an object spread, `{...{ autocorrect: "off" }}`, which
  svelte-check does not reject. So is a bound `value` on an `<li>`, a `<meter>`, a `<data>`, a
  `<button>` or an `<input>` (`{...{ value: score }}`): Svelte's `set_value` writes
  nothing while the element's own `value` holds the bound one (0, "", "on"), where the spread
  assigns it on every render. Svelte writes "0" for one that becomes nullish on a rerender
  (test/assigned-values.browser.test.ts pins it), so the analyser reports a value that may be
  nullish there (UF1002). A class is one `class={…}` (clsx): a lone value, the toggles'
  object, or an array of static names, toggles and values; never `class:` directives, which
  remove a token a value produces (ADR-0038). A style is a static `style="…"` when every
  declaration is static, otherwise one `style:` directive per declaration in source order:
  `style={{…}}` renders `[object Object]`. A spread is written out key by key, its `class` merged
  into the element's class (ADR-0039). Whitespace that Svelte would trim or condense is a
  string-literal mustache (`{" "}`); siblings break lines inside tags (`</li\n><li>`) or after a
  block's closing, as Svelte keeps whitespace between them. Svelte's server renders a `style:`
  directive, and every attribute of an `<option>` or of an element with a spread, through its
  runtime, which escapes static text twice and folds a style's whitespace where its client does
  not; so a static value there holding `&`, `<` or `"`, and a style holding a tab, a line break
  or a run of spaces, is a string-literal mustache too (`style:font-family={"\"A\", serif"}`).

Its toolchain, for tests and tooling (the target's main entry never loads it):

- **`@unframework/target-svelte/toolchain`**: `@sveltejs/vite-plugin-svelte` for Vite; L3 runs
  `svelte/compiler` for the client and the server and reports its errors and warnings
  (accessibility included), and a component that would compile in legacy mode, and compiles a
  composable's `.svelte.ts` module (ADR-0069) as vite-plugin-svelte does, Vite's TypeScript
  transform then `compileModule`, and a shared `.ts` module (ADR-0070) with the transform alone; L4 runs
  svelte-check, from the toolchain directory, once over every file, for types only
  (`--diagnostic-sources js`: the compiler's warnings are L3's), with warnings failing as errors
  do. It refuses files under `node_modules`, which svelte-check reports clean unchecked. L5 runs
  oxlint's shared baseline over the script and ESLint with eslint-plugin-svelte over the whole
  file and over each `.svelte.ts` module, a shared `.ts` module being oxlint's alone (ADR-0042,
  `tests/toolchains/svelte`), with the rules that judge the author's code off
  (`svelte/prefer-svelte-reactivity`: a handler's own `new Map()`; `svelte/prefer-writable-derived`:
  the author's `watchEffect` that writes a state, which a `$derived` would render on the server). In the browser, Vite
  pre-bundles `svelte`, `svelte/events` and the runtime entries the compiled output imports.
- **`…/toolchain/client`**: mounts with `mount` and `flushSync`; `settled` settles. Each key of
  the props reads a `$state.raw` box of its own (`src/toolchain/props.svelte.ts`), so a value is
  the caller's own object, never a deep proxy (identity and `structuredClone` hold, ADR-0046).
  `rerender` empties the keys the new props lack, which restores their `$props()` defaults, and
  assigns the others whose value changed, as a parent does (ADR-0043): re-assigning an unread
  key's same value would hand an effect's teardown Svelte's value from before the flush,
  `undefined`. The test's listeners are
  callback props in it, `onchange` for an event `change`, kept across a rerender (ADR-0050).
- **`…/toolchain/server`**: renders with `svelte/server` and returns the `body`.
