import { formatPrice, pluralise } from "./format";
import { type ComponentProps, type JSX, createMemo, createSignal, splitProps } from "solid-js";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export default function PriceTag(
  props: { cents: number } & PriceTagEvents &
    Omit<ComponentProps<"section">, "cents" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["cents", "onOrder", "class"]);

  const [quantity, setQuantity] = createSignal(1);
  const total = createMemo(() => formatPrice(props.cents * quantity()));

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
