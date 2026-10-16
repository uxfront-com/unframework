<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; value?: number; class?: ClassValue; style?: string };

  let { label, value = $bindable(0), class: className, style }: Props = $props();
</script>

<div class={["stepper", className]} {style}>
  <button type="button" aria-label={`Fewer ${label}`} onclick={() => (value -= 1)}>-</button
  ><span>{label}: {value}</span
  ><button type="button" aria-label={`More ${label}`} onclick={() => (value += 1)}>+</button>
</div>
