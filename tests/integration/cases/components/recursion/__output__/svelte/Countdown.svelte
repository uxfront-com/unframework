<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Countdown from "./Countdown.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { from: number; class?: ClassValue; style?: string };

  let { from, class: className, style }: Props = $props();
</script>

<div class={["level", className]} {style}>
  <span>{from}</span
  >{#if from > 0}
    <Countdown from={from - 1} />
  {:else}
    <strong>Liftoff</strong>
  {/if}
</div>
