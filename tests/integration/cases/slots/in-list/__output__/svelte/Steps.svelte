<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { steps: string[]; marker?: Snippet; class?: ClassValue; style?: string };

  let { steps, marker, class: className, style }: Props = $props();
</script>

<ol class={["steps", className]} {style}>
  {#each steps as step (step)}
    <li>{@render marker?.()}{step}</li>
  {/each}
</ol>
