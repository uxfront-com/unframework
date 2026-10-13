<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { LocaleKey, type LocaleKeyValue } from "./LocaleProvider.svelte";
  import { getContext, hasContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style }: Props = $props();

  const locale = hasContext(LocaleKey) ? getContext<LocaleKeyValue>(LocaleKey) : "en";
</script>

<p class={className} {style}>{locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})</p>
