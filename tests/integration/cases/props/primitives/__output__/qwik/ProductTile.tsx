import { component$ } from "@qwik.dev/core";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

export default component$<ProductTileProps>(({ name, price, stock, available = true }) => {
  return (
    <article class="product-tile" aria-label={name}>
      <h2>{name}</h2>
      <p>Price: {price} EUR</p>
      <p data-stock={stock}>{stock} in stock</p>
      <p>{available ? "Available to order" : "Currently unavailable"}</p>
      <button type="button" disabled={!available}>
        Add {name} to basket
      </button>
    </article>
  );
});
