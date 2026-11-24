<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let shipping = $state(true);
</script>

<section aria-label="Panels" class={className} {style} bind:this={ref} {...attributes}>
  <Disclosure title="Shipping" bind:open={shipping} /><Disclosure title="Returns"
  /><output>Shipping is {shipping ? "open" : "closed"}</output
  ><button type="button" onclick={() => (shipping = !shipping)}>Toggle shipping</button>
</section>
