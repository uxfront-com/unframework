import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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

export default component$<
  ProductSpecProps &
    Omit<PropsOf<"section">, "name" | "availability" | "size" | "finishes" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, availability, size, finishes, class: className, style, ...attributes }) => {
  return (
    <section class={["product-spec", className]} aria-label={name} style={style} {...attributes}>
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
});
