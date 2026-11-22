<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let size = $state("m");
</script>

<section aria-label="Size" class={className} {style} bind:this={ref} {...attributes}>
  <label>Size <select
    bind:value={size}
  ><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label
  ><output>Chosen: {size}</output
  ><button type="button" onclick={() => (size = "l")}>Largest</button>
</section>
