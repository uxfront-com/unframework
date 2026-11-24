<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Picker from "./Picker.svelte";
  import { vTrace } from "./vTrace.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section class={["page", className]} aria-label="Page" {style} bind:this={ref} {...attributes}>
  <Picker>
    {#snippet option({ option })}
      <span
        data-name={`option-${option.id}`}
        {@attach vTrace(() => option.label)}
      >{option.label}</span>
    {/snippet}
  </Picker>
</section>
