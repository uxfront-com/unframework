<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let { name, availability, size, finishes }: ProductSpecProps = $props();
</script>

<section class="product-spec" aria-label={name}>
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
