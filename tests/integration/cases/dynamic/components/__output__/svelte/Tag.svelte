<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Chip from "./Chip.svelte";
  import Card from "./Card.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { label: string; class?: ClassValue; style?: string };

  let { label, class: className, style }: Props = $props();

  let compact = $state(true);

  const Component = $derived(compact ? Chip : Card);
</script>

<section aria-label="Tag" class={className} {style}>
  <Component {label}
  /><button
    type="button"
    onclick={() => (compact = !compact)}
  >{compact ? "Expand" : "Compact"}</button>
</section>
