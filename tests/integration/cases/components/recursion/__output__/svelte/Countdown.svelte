<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Countdown from "./Countdown.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "from" | "children" | "class" | "style" | "ref"> & {
    from: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { from, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["level", className]} {style} bind:this={ref} {...attributes}>
  <span>{from}</span
  >{#if from > 0}
    <Countdown from={from - 1} />
  {:else}
    <strong>Liftoff</strong>
  {/if}
</div>
