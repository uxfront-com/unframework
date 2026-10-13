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

  let { name, price, stock, available = true, class: className, style }: Props = $props();
</script>

<article class={["product-tile", className]} aria-label={name} {style}>
  <h2>{name}</h2
  ><p>Price: {price} EUR</p
  ><p data-stock={stock}>{stock} in stock</p
  ><p>{available ? "Available to order" : "Currently unavailable"}</p
  ><button type="button" disabled={!available}>Add {name} to basket</button>
</article>
