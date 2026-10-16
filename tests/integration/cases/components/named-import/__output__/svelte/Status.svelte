<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Badge from "./Badge.svelte";
  import Tag from "./Pill.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { state: string; class?: ClassValue; style?: string };

  let { state, class: className, style }: Props = $props();
</script>

<p class={["status", className]} {style}>
  <Badge text="Build" /><Tag text={state} />
</p>
