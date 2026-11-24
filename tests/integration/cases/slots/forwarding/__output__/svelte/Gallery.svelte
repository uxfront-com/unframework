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
  <Frame label="Filled">
    <p>Taken at dusk.</p
    >{#snippet title()}Sunset{/snippet}
  </Frame
  ><Frame label="Empty" />
</div>
