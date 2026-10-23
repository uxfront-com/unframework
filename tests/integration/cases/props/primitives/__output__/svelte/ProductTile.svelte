<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ProductTileProps {
    name: string;
    price: number;
    stock: number;
    available?: boolean;
  }

  type Props = ProductTileProps & { class?: ClassValue; style?: string };

  let {
    name,
    price,
    stock,
    available = true,
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

<article
  class={["product-tile", className]}
  aria-label={name}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{name}</h2
  ><p>Price: {price} EUR</p
  ><p data-stock={stock}>{stock} in stock</p
  ><p>{available ? "Available to order" : "Currently unavailable"}</p
  ><button type="button" disabled={!available}>Add {name} to basket</button>
</article>
