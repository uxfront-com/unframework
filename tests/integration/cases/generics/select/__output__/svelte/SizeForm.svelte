<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Select from "./Select.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Size = "s" | "m" | "l";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const sizes: Size[] = ["s", "m", "l"];
  let size = $state<Size>("m");
</script>

<section aria-label="Size" class={className} {style} bind:this={ref} {...attributes}>
  <Select label="Size" options={sizes} bind:value={size} /><output>Chosen: {size}</output>
</section>
