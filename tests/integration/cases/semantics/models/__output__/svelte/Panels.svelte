<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let shipping = $state(true);
</script>

<section aria-label="Panels" class={className} {style}>
  <Disclosure title="Shipping" bind:open={shipping} /><Disclosure title="Returns"
  /><output>Shipping is {shipping ? "open" : "closed"}</output
  ><button type="button" onclick={() => (shipping = !shipping)}>Toggle shipping</button>
</section>
