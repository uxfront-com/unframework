# @unframework/target-vue

The Vue 3.5 target of the Unframework compiler: single-file components with a template.
Single-selection list boxes are declared unsupported (`listbox`): Vue's client selects their
first option, where HTML and the other targets select none (ADR-0033).

Its toolchain, for tests and tooling (the target's main entry never loads it):

- **`@unframework/target-vue/toolchain`**: `@vitejs/plugin-vue` for Vite (static asset URLs stay
  plain strings, as on every other target); L3 runs `@vue/compiler-sfc` the way plugin-vue does,
  for the DOM and for SSR, and reports every error and warning with its position (it refuses
  `NODE_ENV=production`, which silences them); L4 runs vue-tsc with `strictTemplates`, from the
  toolchain directory, once over every file.
- **`…/toolchain/client`**: mounts with `createApp`; `nextTick` settles.
- **`…/toolchain/server`**: renders with `createSSRApp` and `vue/server-renderer`.
