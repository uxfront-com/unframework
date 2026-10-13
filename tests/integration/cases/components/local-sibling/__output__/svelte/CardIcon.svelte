<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { symbol: string; class?: ClassValue; style?: string };

  let { symbol, class: className, style }: Props = $props();
</script>

<span class={["icon", className]} aria-hidden="true" {style}>{symbol}</span>
