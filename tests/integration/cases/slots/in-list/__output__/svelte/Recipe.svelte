<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Steps from "./Steps.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "steps" | "children" | "class" | "style" | "ref"> & {
    steps: string[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { steps, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <Steps {steps}>
    {#snippet marker()}
      <span aria-hidden="true">{"\u003e "}</span>
    {/snippet}
  </Steps>
</div>
