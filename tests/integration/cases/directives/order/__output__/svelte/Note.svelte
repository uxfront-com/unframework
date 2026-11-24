<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vNote } from "./vNote.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["em"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["em"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<em
  data-name="note"
  {@attach vNote(() => "note")}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>Note</em>
