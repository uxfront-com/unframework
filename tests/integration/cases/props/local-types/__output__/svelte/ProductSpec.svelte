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

  let {
    name,
    availability,
    size,
    finishes,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["product-spec", className]}
  aria-label={name}
  {style}
  {...scopeAttributes(attributes)}
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
