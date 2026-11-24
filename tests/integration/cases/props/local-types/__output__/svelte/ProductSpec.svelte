<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
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
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "name" | "availability" | "size" | "finishes" | "children" | "class" | "style" | "ref"
  > &
    ProductSpecProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    name,
    availability,
    size,
    finishes,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["product-spec", className]}
  aria-label={name}
  {style}
  bind:this={ref}
  {...attributes}
>
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
