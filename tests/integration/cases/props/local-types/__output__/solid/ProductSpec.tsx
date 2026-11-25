import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

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
  props: ProductSpecProps &
    Omit<ComponentProps<"section">, "name" | "availability" | "size" | "finishes" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["name", "availability", "size", "finishes", "class"]);

  return (
    <section
      class={props.class ? `product-spec ${props.class}` : "product-spec"}
      aria-label={props.name}
      {...others}
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
        <KeyedFor each={props.finishes} by={(finish) => finish.sku}>
          {(finish) => (
            <li>
              {finish.value.label} ({finish.value.sku})
            </li>
          )}
        </KeyedFor>
      </ul>
    </section>
  );
}
