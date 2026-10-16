<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Counter from "./Counter.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let counter: { increment(): void; reset(): void } | null = null;
</script>

<div class={["controls", className]} {style}>
  <Counter bind:this={counter} start={10}
  /><button type="button" onclick={() => counter?.increment()}>More</button
  ><button type="button" onclick={() => counter?.reset()}>Reset</button>
</div>
