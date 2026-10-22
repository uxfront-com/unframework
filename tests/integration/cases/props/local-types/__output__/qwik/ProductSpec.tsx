import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

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

export default component$<ProductSpecProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, availability, size, finishes, class: className, style, ...attributes }) => {
    return (
      <section
        class={["product-spec", className]}
        aria-label={name}
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
