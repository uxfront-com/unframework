import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

type Availability = "in-stock" | "backorder" | "discontinued";

interface Finish {
  sku: string;
  label: string;
}

export interface ProductSpecProps {
  name: string;
  availability: Availability;
  size: { width: number; depth: number; unit: "cm" | "in" };
  finishes: Finish[];
}

export interface ProductSpecAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ProductSpec({
  name,
  availability,
  size,
  finishes,
  className,
  style,
  ...attributes
}: ProductSpecProps & ProductSpecAttributes) {
  return (
    <section
      className={cx("product-spec", className)}
      aria-label={name}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{name}</h2>
      <dl>
        <dt>Availability</dt>
        <dd>{availability}</dd>
        <dt>Size</dt>
        <dd>
          {size.width} × {size.depth} {size.unit}
        </dd>
      </dl>
      <ul>
        {finishes.map((finish) => (
          <li key={finish.sku}>
            {finish.label} ({finish.sku})
          </li>
        ))}
      </ul>
    </section>
  );
}
