<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style }: Props = $props();

  let input: HTMLInputElement | null = null;

  export function focus() {
    input?.focus();
  }
</script>

<label
  class={["search", className]}
  {style}
>{label}<input bind:this={input} type="search" /></label>
