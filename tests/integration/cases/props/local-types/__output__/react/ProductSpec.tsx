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
}: ProductSpecProps & ProductSpecAttributes) {
  return (
    <section className={cx("product-spec", className)} aria-label={name} style={style}>
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
