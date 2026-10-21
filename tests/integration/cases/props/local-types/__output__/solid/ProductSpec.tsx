import { For, type JSX } from "solid-js";

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

export default function ProductSpec(
  props: ProductSpecProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `product-spec ${props.class}` : "product-spec"}
      aria-label={props.name}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.name}</h2>
      <dl>
        <dt>Availability</dt>
        <dd>{props.availability}</dd>
        <dt>Size</dt>
        <dd>
          {props.size.width} × {props.size.depth} {props.size.unit}
        </dd>
      </dl>
      <ul>
        <For each={props.finishes}>
          {(finish) => (
            <li>
              {finish.label} ({finish.sku})
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
