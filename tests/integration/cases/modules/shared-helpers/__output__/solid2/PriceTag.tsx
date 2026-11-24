import { createState } from "./_unframework/createState";
import { formatPrice, pluralise } from "./format";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export default function PriceTag(
  props: { cents: number } & PriceTagEvents &
    Omit<ComponentProps<"section">, "cents" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "cents", "onOrder", "class");

  const [quantity, setQuantity] = createState(1);
  const total = () => formatPrice(props.cents * quantity());

  function order() {
    props.onOrder?.(`${pluralise(quantity(), "item")} for ${total()}`);
  }

  return (
    <section
      class={props.class ? `price-tag ${props.class}` : "price-tag"}
      aria-label="Price"
      {...others}
    >
      <p>Each: {formatPrice(props.cents)}</p>
      <p role="status">
        {pluralise(quantity(), "item")}: {total()}
      </p>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        One more
      </button>
      <button type="button" onClick={order}>
        Order
      </button>
    </section>
  );
}
