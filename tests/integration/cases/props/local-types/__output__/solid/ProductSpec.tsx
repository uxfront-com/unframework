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
