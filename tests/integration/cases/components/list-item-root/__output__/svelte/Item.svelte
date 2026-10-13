<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style }: Props = $props();
</script>

<li class={["item", className]} {style}>{label}</li>
