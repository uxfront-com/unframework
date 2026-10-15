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
}: ProductTileProps & ProductTileAttributes) {
  return (
    <article className={cx("product-tile", className)} aria-label={name} style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
