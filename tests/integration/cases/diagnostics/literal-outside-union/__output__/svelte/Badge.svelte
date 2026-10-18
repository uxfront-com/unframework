<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { tone: "info" | "warning"; class?: ClassValue; style?: string };

  let { tone, class: className, style }: Props = $props();
</script>

<span class={["badge", tone, className]} {style}>{tone}</span>
