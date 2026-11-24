import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

export default function ProductTile(
  rawProps: ProductTileProps &
    Omit<ComponentProps<"article">, "name" | "price" | "stock" | "available" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps({ available: true } satisfies Partial<ProductTileProps>, rawProps);
  const [, others] = splitProps(props, ["name", "price", "stock", "available", "class"]);

  return (
    <article
      class={props.class ? `product-tile ${props.class}` : "product-tile"}
      aria-label={props.name}
      {...others}
    >
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
