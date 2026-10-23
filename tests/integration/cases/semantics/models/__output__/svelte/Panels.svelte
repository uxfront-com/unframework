<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Disclosure from "./Disclosure.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let shipping = $state(true);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Panels" class={className} {style} {...scopeAttributes(attributes)}>
  <Disclosure title="Shipping" bind:open={shipping} /><Disclosure title="Returns"
  /><output>Shipping is {shipping ? "open" : "closed"}</output
  ><button type="button" onclick={() => (shipping = !shipping)}>Toggle shipping</button>
</section>
