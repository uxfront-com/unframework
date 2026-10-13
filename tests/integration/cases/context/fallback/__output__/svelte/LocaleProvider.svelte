<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export type LocaleKeyValue = string;
  export const LocaleKey = Symbol("uf.locale");
</script>

<script lang="ts">
  import { type Snippet, setContext, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { locale: string; children?: Snippet; class?: ClassValue; style?: string };

  let { locale, children, class: className, style }: Props = $props();

  setContext(
    LocaleKey,
    untrack(() => locale),
  );
</script>

<div lang={locale} class={className} {style}>{@render children?.()}</div>
