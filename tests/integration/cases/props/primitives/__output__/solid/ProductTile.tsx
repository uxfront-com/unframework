import { mergeProps } from "solid-js";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

export default function ProductTile(rawProps: ProductTileProps) {
  const props = mergeProps({ available: true } satisfies Partial<ProductTileProps>, rawProps);
  return (
    <article class="product-tile" aria-label={props.name}>
      <h2>{props.name}</h2>
      <p>Price: {props.price} EUR</p>
      <p data-stock={props.stock}>{props.stock} in stock</p>
      <p>{props.available ? "Available to order" : "Currently unavailable"}</p>
      <button type="button" disabled={!props.available}>
        Add {props.name} to basket
      </button>
    </article>
  );
}
