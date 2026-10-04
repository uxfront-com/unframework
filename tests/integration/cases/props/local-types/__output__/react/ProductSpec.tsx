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

export default function ProductSpec({ name, availability, size, finishes }: ProductSpecProps) {
  return (
    <section className="product-spec" aria-label={name}>
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
