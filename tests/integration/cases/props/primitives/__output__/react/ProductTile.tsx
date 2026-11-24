import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

export type ProductTileAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "name" | "price" | "stock" | "available" | "children"
>;

export default function ProductTile({
  name,
  price,
  stock,
  available = true,
  className,
  style,
  ...attributes
}: ProductTileProps & ProductTileAttributes) {
  return (
    <article
      className={cx("product-tile", className)}
      aria-label={name}
      style={style}
      {...attributes}
    >
      <h2>{name}</h2>
      <p>Price: {price} EUR</p>
      <p data-stock={stock}>{stock} in stock</p>
      <p>{available ? "Available to order" : "Currently unavailable"}</p>
      <button type="button" disabled={!available}>
        Add {name} to basket
      </button>
    </article>
  );
}
