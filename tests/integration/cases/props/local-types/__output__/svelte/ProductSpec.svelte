<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Availability = "in-stock" | "backorder" | "discontinued";

  interface Finish {
    sku: string;
    label: string;
  }

  export interface ProductSpecProps {
    name: string;
    availability: Availability;
    size: { width: number; depth: number; unit: "cm" | "in" };
    finishes: Finish[];
  }

  type Props = ProductSpecProps & { class?: ClassValue; style?: string };

  let { name, availability, size, finishes, class: className, style }: Props = $props();
</script>

<section class={["product-spec", className]} aria-label={name} {style}>
  <h2>{name}</h2
  ><dl>
    <dt>Availability</dt
    ><dd>{availability}</dd
    ><dt>Size</dt
    ><dd>{size.width} × {size.depth} {size.unit}</dd>
  </dl
  ><ul>
    {#each finishes as finish (finish.sku)}
      <li>{finish.label} ({finish.sku})</li>
    {/each}
  </ul>
</section>
