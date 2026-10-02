# @unframework/target-svelte

The Svelte 5 target of the Unframework compiler: runes-mode components. Every component
declares `<svelte:options runes={true} />`, so one without runes never compiles in legacy mode.

Its toolchain, for tests and tooling (the target's main entry never loads it):

- **`@unframework/target-svelte/toolchain`**: `@sveltejs/vite-plugin-svelte` for Vite; L3 runs
  `svelte/compiler` for the client and the server and reports its errors and warnings
  (accessibility included), and a component that would compile in legacy mode; L4 runs
  svelte-check, from the toolchain directory, once over every file, for types only
  (`--diagnostic-sources js`: the compiler's warnings are L3's), with warnings failing as errors
  do. It refuses files under `node_modules`, which svelte-check reports clean unchecked.
- **`…/toolchain/client`**: mounts with `mount` and `flushSync`; `settled` settles.
- **`…/toolchain/server`**: renders with `svelte/server` and returns the `body`.
