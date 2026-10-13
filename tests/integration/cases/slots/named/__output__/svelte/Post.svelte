<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { author: string; class?: ClassValue; style?: string };

  let { author, class: className, style }: Props = $props();
</script>

<Card class={className} {style}>
  <p>Slots arrive in M3.</p
  >{#snippet header()}
    <h2>Release notes</h2>
  {/snippet}{#snippet footer()}
    <small>By {author}</small>
  {/snippet}
</Card>
