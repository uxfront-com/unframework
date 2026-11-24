<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ProductTileProps {
    name: string;
    price: number;
    stock: number;
    available?: boolean;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "name" | "price" | "stock" | "available" | "children" | "class" | "style" | "ref"
  > &
    ProductTileProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    name,
    price,
    stock,
    available = true,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article
  class={["product-tile", className]}
  aria-label={name}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{name}</h2
  ><p>Price: {price} EUR</p
  ><p data-stock={stock}>{stock} in stock</p
  ><p>{available ? "Available to order" : "Currently unavailable"}</p
  ><button type="button" disabled={!available}>Add {name} to basket</button>
</article>
