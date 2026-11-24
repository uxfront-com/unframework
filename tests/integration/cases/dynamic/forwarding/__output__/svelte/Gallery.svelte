<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Frame from "./Frame.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <Frame label="Card" wide={false}>
    {#snippet title()}Sunset{/snippet}
  </Frame
  ><Frame label="Panel" wide={true}>
    {#snippet title()}Dawn{/snippet}
  </Frame
  ><Frame label="Empty" wide={true} />
</div>
