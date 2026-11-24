<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let agreed = $state(false);
</script>

<section aria-label="Terms" class={className} {style} bind:this={ref} {...attributes}>
  <label><input type="checkbox" bind:checked={agreed} /> I agree</label
  ><output>{agreed ? "Agreed" : "Not agreed"}</output
  ><button type="button" onclick={() => (agreed = !agreed)}>Toggle</button>
</section>
