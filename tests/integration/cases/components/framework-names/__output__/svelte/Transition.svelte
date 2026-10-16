<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { step: string; class?: ClassValue; style?: string };

  let { step, class: className, style }: Props = $props();
</script>

<p class={["step", className]} {style}>Step: {step}</p>
