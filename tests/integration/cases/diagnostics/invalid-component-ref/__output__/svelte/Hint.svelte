<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; class?: ClassValue; style?: string };

  let { text, class: className, style }: Props = $props();
</script>

<small class={["hint", className]} {style}>{text}</small>
