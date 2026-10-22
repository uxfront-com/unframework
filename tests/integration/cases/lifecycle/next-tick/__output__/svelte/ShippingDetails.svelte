<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { ontoggled?: (items: number) => void; class?: ClassValue; style?: string };

  let { ontoggled, class: className, style, ...attributes }: Props = $props();

  let open = $state(false);
  let details = $state<HTMLUListElement | null>(null);

  async function toggle() {
    open = !open;
    await tick();
    ontoggled?.(details?.childElementCount ?? 0);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["shipping-details", className]}
  aria-label="Shipping"
  {style}
  {...scopeAttributes(attributes)}
>
  <button type="button" aria-expanded={open} onclick={toggle}>Shipping details</button
  >{#if open}
    <ul bind:this={details}>
      <li>Ships in two days</li
      ><li>Free returns</li
      ><li>Tracked delivery</li>
    </ul>
  {/if}
</section>
