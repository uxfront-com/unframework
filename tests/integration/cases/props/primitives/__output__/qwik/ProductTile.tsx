import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

export default component$<ProductTileProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, price, stock, available = true, class: className, style }) => {
    return (
      <article class={["product-tile", className]} aria-label={name} style={style}>
        <h2>{name}</h2>
        <p>Price: {price} EUR</p>
        <p data-stock={stock}>{stock} in stock</p>
        <p>{available ? "Available to order" : "Currently unavailable"}</p>
        <button type="button" disabled={!available}>
          Add {name} to basket
        </button>
      </article>
    );
  },
);
