<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; tone: "info" | "quiet"; class?: ClassValue; style?: string };

  let { text, tone, class: className, style }: Props = $props();
</script>

<p role="status" class={["notice", tone, className]} {style}>{text}</p>
