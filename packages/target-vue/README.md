# @unframework/target-vue

The Vue 3.5 target of the Unframework compiler, and the reference target (D10): what Vue renders
becomes every target's shared expectation. It emits one single-file component per component
(design §5.2):

- **`<script setup lang="ts">`** when the component takes props (`src/script.ts`): the type
  declarations the props reach, copied as written, then one `defineProps<P>()` with the source's
  annotation.
  - Destructured props use Vue 3.5's reactive destructure:
    `const { label, tone = "info", count = undefined } = defineProps<BadgeProps>();`. Every
    optional prop gets a default, the source's or `undefined`, for two reasons. Without a
    default, Vue casts an absent `Boolean` prop to `false`, where every other target leaves it
    `undefined` (ADR-0034). And `vue/require-default-prop` asks for a default for each optional
    prop, read or not, so unread optional props stay in the pattern, each under a local that
    starts with `_` (`size: _size = 2`), which the unused-variable rule ignores. Vue compiles the
    pattern away, so the local never meets the `_` names of its compiled code. A required prop
    is in the pattern only when an expression reads it.
  - The object form is `const props = defineProps<P>()`, through
    `withDefaults(…, { title: undefined })` when a prop is optional.
  - A component that reads no prop declares its props with `defineProps<P>();` alone.
  - Some names cannot be declared as they are, so the prop gets a fresh local (`{ Map: Map_1 }`)
    and the template reads that local:
    - Vue's compiler macros, which vue-tsc declares in the script's scope (TS2451);
    - the globals Vue's template compiler never prefixes (`Map`, `console`, `require`, …),
      which every expression but a lone identifier reads as the global;
    - in the object form, a name with Vue's own `_` or `$` prefix (`__props` is declared by
      the compiled `setup`): the object is declared as `props`.
  - The target writes `</script` in copied code as `<\/script`.
- **A template** printed by the Vue markup dialect (`@unframework/codegen`'s `vueDialect`, owned
  with this target). The template uses:
  - `{{ }}` interpolations;
  - `:attr` bindings;
  - `v-if`, `v-else-if` and `v-else` on a branch's element, or on a `<template>` around other
    content;
  - keyed `v-for`, never beside a `v-if`;
  - a static `class` beside `:class`, and a static `style` beside `:style`;
  - a spread written out as one binding per declared key;
  - attributes in `vue/attributes-order`.

  Expressions are printed as written. A component without props is a template alone.

Single-selection list boxes are declared unsupported (`listbox`): Vue's client selects their
first option, where HTML and the other targets select none (ADR-0033). Every other capability is
native.

Its toolchain, for tests and tooling (the target's main entry never loads it):

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
    oxlint does not run on a `.vue` file.
- **`…/toolchain/client`**: mounts with `createApp`, through a render function that passes the
  props from a shallow reactive object. `rerender` replaces them whole: an absent key is deleted,
  so the prop takes its default again. `nextTick` settles.
- **`…/toolchain/server`**: renders with `createSSRApp` and `vue/server-renderer`.
