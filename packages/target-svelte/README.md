# @unframework/target-svelte

The Svelte 5 target of the Unframework compiler: runes-mode components. Every component
declares `<svelte:options runes={true} preserveWhitespace={false} />`, so one without runes never
compiles in legacy mode and the markup's layout holds whatever the consumer's whitespace option.

A component is that line, an instance script when it takes props, and its markup (plan §6,
design §5.3):

```svelte
<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface BadgeProps {
    label: string;
    tone?: "info" | "warn";
  }

  let { label, tone = "info" }: BadgeProps = $props();
</script>

<p class={["badge", `badge-${tone}`]}>{label}</p>
```

- **Props** (ADR-0034). The script copies the type declarations the props reach, as written
  (exported where the source exports them), and reads the props with `$props()`: a destructured
  pattern in source order with the defaults as written, or the source's props object
  (`let props: CardProps = $props()`, read as `props.title`). A destructured prop that no
  expression reads is left out; a component that reads none declares `let props: P` (an empty
  pattern is `no-empty-pattern`). A props object whose name Svelte reserves (`$`-prefixed) is
  named `props`. Script lines are indented, but for lines inside a multi-line literal.
- **Markup** (`svelteDialect` in `@unframework/codegen`). `{expr}`, `{#if}{:else if}{:else}{/if}`,
  `{#each source as item, index (key)}…{/each}` (the index only when an expression reads it),
  `name={expr}`, and Svelte's shorthands where the value is the variable of the same name
  (`{href}`, `style:color`). A class is one `class={…}` (clsx): a lone value, the toggles'
  object, or an array of static names, toggles and values; never `class:` directives, which
  remove a token a value produces (ADR-0038). A style is a static `style="…"` when every
  declaration is static, otherwise one `style:` directive per declaration in source order:
  `style={{…}}` renders `[object Object]`. A spread is written out key by key, its `class` merged
  into the element's class (ADR-0039). Whitespace that Svelte would trim or condense is a
  string-literal mustache (`{" "}`); siblings break lines inside tags (`</li\n><li>`) or after a
  block's closing, as Svelte keeps whitespace between them.

Its toolchain, for tests and tooling (the target's main entry never loads it):

- **`@unframework/target-svelte/toolchain`**: `@sveltejs/vite-plugin-svelte` for Vite; L3 runs
  `svelte/compiler` for the client and the server and reports its errors and warnings
  (accessibility included), and a component that would compile in legacy mode; L4 runs
  svelte-check, from the toolchain directory, once over every file, for types only
  (`--diagnostic-sources js`: the compiler's warnings are L3's), with warnings failing as errors
  do. It refuses files under `node_modules`, which svelte-check reports clean unchecked. L5 runs
  oxlint's shared baseline over the script and ESLint with eslint-plugin-svelte over the whole
  file (ADR-0042, `tests/toolchains/svelte`).
- **`…/toolchain/client`**: mounts with `mount` and `flushSync`; `settled` settles. The props are
  a `$state` object (`src/toolchain/props.svelte.ts`), so `rerender` deletes the keys the new
  props lack, which restores their `$props()` defaults, and assigns the others (ADR-0043).
- **`…/toolchain/server`**: renders with `svelte/server` and returns the `body`.
