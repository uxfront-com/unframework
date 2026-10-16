<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { ontoggled?: (items: number) => void; class?: ClassValue; style?: string };

  let { ontoggled, class: className, style }: Props = $props();

  let open = $state(false);
  let details = $state<HTMLUListElement | null>(null);

  async function toggle() {
    open = !open;
    await tick();
    ontoggled?.(details?.childElementCount ?? 0);
  }
</script>

<section class={["shipping-details", className]} aria-label="Shipping" {style}>
  <button type="button" aria-expanded={open} onclick={toggle}>Shipping details</button
  >{#if open}
    <ul bind:this={details}>
      <li>Ships in two days</li
      ><li>Free returns</li
      ><li>Tracked delivery</li>
    </ul>
  {/if}
</section>
