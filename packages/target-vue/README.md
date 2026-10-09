# @unframework/target-vue

The Vue 3.5 target of the Unframework compiler, and the reference target (D10): what Vue renders,
and what it does when a test interacts with it, becomes every target's shared expectation. It
emits one single-file component per component (plan §6): its script, then its template.

## The script

**`<script setup lang="ts">`** when the component takes props, declares events, has setup code
or a listener its template cannot hold (`src/script.ts`). A component with none of these is a
template alone. The source's Composition API is Vue's (plan §4), so the script is the source's
setup as written, `.value` included (ADR-0045 to ADR-0049). In order:

1. **The imports** from `vue` (`ref`, `shallowRef`, `computed`, `watch`, `watchPostEffect`,
   `onMounted`, `onUnmounted`, `useTemplateRef`, `useId`, `nextTick`), each under a name no
   source name takes.
2. **The type declarations** the component reaches (its props, its events and its setup code),
   copied as written.
3. **`defineProps<P>()`** with the source's annotation.
   - Destructured props use Vue 3.5's reactive destructure:
     `const { label, tone = "info", count = undefined } = defineProps<BadgeProps>();`. Every
     optional prop gets a default, the source's or `undefined`, for two reasons. Without a
     default, Vue casts an absent `Boolean` prop to `false`, where every other target leaves it
     `undefined` (ADR-0034). And `vue/require-default-prop` asks for a default for each optional
     prop, read or not, so unread optional props stay in the pattern, each under a local that
     starts with `_` (`size: _size = 2`), which the unused-variable rule ignores. Vue compiles
     the pattern away, so the local never meets the `_` names of its compiled code. A required
     prop is in the pattern only when some code reads it, setup code and handlers included.
   - The object form is `const props = defineProps<P>()`, through
     `withDefaults(…, { title: undefined })` when a prop is optional.
   - A component that reads no prop declares its props with `defineProps<P>();` alone.
   - Some names cannot be declared as they are, so the binding gets a fresh local
     (`{ Map: Map_1 }`) and every reference reads that local:
     - Vue's compiler macros, which vue-tsc declares in the script's scope (TS2451);
     - the globals Vue's template compiler never prefixes (`Map`, `console`, `require`, …),
       which every expression but a lone identifier reads as the global;
     - in the object form, a name with Vue's own `_` or `$` prefix (`__props` is declared by
       the compiled `setup`): the object is declared as `props`.
4. **`const emit = defineEmits<E>();`** with the source's type argument, right after the props
   (Vue's macro order), or `defineEmits<E>();` alone when nothing calls `emit`.
5. **The setup, in source order**:

   | Source                                    | Vue output                                                     |
   | ----------------------------------------- | -------------------------------------------------------------- |
   | `const count = ref(0)`                    | the same for a primitive; `shallowRef(…)` otherwise (below)    |
   | `const total = computed(() => …)`         | the same                                                       |
   | `const field = useTemplateRef<T>()`       | `useTemplateRef<T>("field")`, keyed by the binding's name      |
   | `const id = useId()`                      | `` `uf-id-${useId()}` `` (the generated-id prefix)             |
   | `const`, `let`, `function`, arrow `const` | as written                                                     |
   | `watch(source, callback, options)`        | the same; a prop or a `shallowRef` by a getter                 |
   | `watchEffect(effect)`                     | `watchPostEffect(effect)`: after the render, never on a server |
   | `onMounted`, `onUnmounted`, `nextTick`    | the same                                                       |

   State is replaced whole (ADR-0008, UF2004), so a state not known to hold a primitive
   (`isPrimitiveState` from `@unframework/codegen`: its type argument or its initial value) is a
   `shallowRef`, whose value is the source's own object, never a deep proxy: identity with a
   prop's item, `structuredClone` and an emitted payload read it as the source does (ADR-0046,
   as Svelte's `$state.raw`). Vue calls a watcher back on every run once one of its sources is
   shallow, changed or not (two writes that end on the value it had included), so such a source,
   alone or in an array, is read through a getter, whose value Vue compares
   (`watch(() => selected.value, …)`, `watch([() => picks.value, count], …)`).

6. **The listeners' functions**: a handler the template cannot hold, as `function onClick(…)`.

The target writes `</script` in copied code as `<\/script`.

## The template

Printed by the Vue markup dialect (`@unframework/codegen`'s `vueDialect`, owned with this
target):

- `{{ }}` interpolations and `:attr` bindings, with a setup ref's value read as the ref, which Vue
  unwraps (`{{ count }}`, `:aria-pressed="selected === task.id"`); everything else as written;
- `v-if`, `v-else-if` and `v-else` on a branch's element, or on a `<template>` around other
  content; keyed `v-for`, never beside a `v-if`;
- a static `class` beside `:class`, a static `style` beside `:style`, a spread written out as one
  binding per declared key;
- `ref="field"` for a template ref;
- listeners (`src/listeners.ts`):
  - a setup function by name: `@click="save"`;
  - an inline handler of one expression the template can read, as Vue's inline statement:
    `@click="count++"`, `@click="select(task.id)"`, `@click="emit('refresh')"`; one that reads
    its event, or is `async`, as the arrow it is:
    `@input="(event) => (note = (event.currentTarget as HTMLInputElement).value)"`;
  - the options as Vue's modifiers, `.capture`, `.once`, `.passive`, and a handler's leading
    `stopPropagation()` and `preventDefault()` as `.stop` and `.prevent`
    (`@click.stop="record('stopped')"`, `@submit.prevent`);
  - any other handler moves to a script function the template names, its unannotated event
    parameter typed as `@vue/runtime-dom` types the event;
- attributes in `vue/attributes-order`: `ref` with `key`, listeners last.

## Capabilities

Single-selection list boxes are declared unsupported (`listbox`): Vue's client selects their
first option, where HTML and the other targets select none (ADR-0033). Every other capability is
native: the listeners' options and DOM semantics, `useId` and `nextTick` are Vue's own, and so is
all of composition.

## Composition

Components, slots, fallthrough and `defineExpose` (ADR-0053, ADR-0054) are Vue's own:

- a child is imported by its output file, `import Field from "./Field.vue"`, a component of the
  same file included; a component that renders itself names itself with
  `defineOptions({ name: "Tree" })` instead of importing its own file, which
  `import/no-self-import` rejects, and which Vue resolves as a self-reference;
- a component's props and events are hyphenated in the template (`:item-label`, `@level-change`),
  as `vue/attribute-hyphenation` and `vue/v-on-event-hyphenation` ask;
- `defineSlots<{ default?(): unknown; item?(props: P): unknown }>()`, bound as `slots` only where
  the template tests or forwards a slot; slots render as `<slot>`, a scoped slot's props key by
  key, the fallback as its content; fills are the children, or `<template #title>` and
  `<template #item="{ item }">`, and a forwarded slot is the parent's own `<slot>` in a template
  under its presence, `<template v-if="slots.title" #title>`;
- `class` and `style` fall through as Vue makes them, `defineOptions({ inheritAttrs: false })`
  turns it off, and `defineExpose({ … })` comes last, once every function it names is declared.

Models, context and `<component is>` (ADR-0054) are Vue's own as well:

- `defineModel` as written, with the other macros; an unbound model without a default gets
  `{ default: undefined }` and `T | undefined`, or Vue would cast an absent boolean model to
  `false` (ADR-0034);
- a control's `v-model` with its modifiers (`v-model.trim`); a range input takes `.number`,
  since Vue's `vModelText` casts only a number input's value, and the contract casts both; a
  component's `v-model:value`;
- the module's injection keys in a plain `<script lang="ts">` block of its main component's
  output (the default export's), typed with Vue's `InjectionKey` (and `Ref`), which another
  component imports from that file; `provide` and `inject` as written; the template reads an
  injected ref without its `.value`, as it reads the setup's own refs;
- `<component :is="…">`, a candidate named like a Vue built-in under its alias.

## The toolchain

For tests and tooling (the target's main entry never loads it):

- **`@unframework/target-vue/toolchain`**: `@vitejs/plugin-vue` for Vite. Static asset URLs stay
  plain strings, as on every other target. The checks:
  - L3 runs `@vue/compiler-sfc` the way plugin-vue does, for the DOM and for SSR, and reports
    every error and warning with its position. It refuses `NODE_ENV=production`, which silences
    them.
  - L4 runs vue-tsc with `strictTemplates`, from the toolchain directory, once over every file.
    `tests/toolchains/vue/tsconfig.json` allows `data-*` and the few HTML attributes Vue's
    element types lack.
  - L5 (ADR-0042) runs oxlint's shared baseline over the script block and ESLint with
    eslint-plugin-vue over the whole file, with typescript-eslint's `no-unused-vars`, which
    oxlint does not run on a `.vue` file. No rule is off for M2.
- **`…/toolchain/client`**: mounts with `createApp`, through a render function that passes the
  props from a shallow reactive object, and the test's listeners beside them as Vue's listener
  props (`onChange` for an event `change`), only for the events the component declares, so a
  rerender never removes them. `rerender` replaces the props whole: an absent key is deleted, so
  the prop takes its default again. `nextTick` settles: watchers and post-flush effects have run.
- **`…/toolchain/server`**: renders with `createSSRApp` and `vue/server-renderer`. Vue runs an
  immediate watcher's first callback during the server's setup, and nothing else of the effects.

Its own tests pin the shapes (`test/emit.test.ts`, `test/lint-probes.ts` against L3, L4 and L5),
the server's setup (`test/setup.test.ts`), and the behaviour of the emitted components in
Chromium (`test/behaviour.browser.test.ts`: reads after writes, watch timing, previous values
and cleanup, lifecycle, template refs, ids, listeners and their options, emits).
