<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Chart from "./Chart.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(false);

  function show() {
    open = true;
  }
</script>

<section aria-label="Report" class={className} {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={show}>Show the chart</button
  >{#if open}
    <Chart />
  {/if}
</section>
