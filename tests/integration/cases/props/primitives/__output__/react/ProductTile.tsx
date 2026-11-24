import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

export interface ProductTileAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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
