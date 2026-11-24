import { type ComponentProps, type JSX, createMemo, createSignal, splitProps } from "solid-js";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export default function OrderSummary(
  props: OrderSummaryProps &
    Omit<ComponentProps<"section">, "price" | "taxRate" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["price", "taxRate", "class"]);

  const [quantity, setQuantity] = createSignal(1);
  const subtotal = createMemo(() => quantity() * props.price);
  const tax = createMemo(() => Math.round(subtotal() * props.taxRate));
  const total = createMemo(() => subtotal() + tax());
  const tier = createMemo(() => {
    if (total() >= 10000) return "bulk";
    return "standard";
  });

  return (
    <section
      class={props.class ? `order-summary ${props.class}` : "order-summary"}
      aria-label="Order summary"
      data-tier={tier()}
      {...others}
    >
      <p role="status">Quantity: {quantity()}</p>
      <button type="button" disabled={quantity() === 1} onClick={() => setQuantity(quantity() - 1)}>
        Remove one
      </button>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
      </button>
      <p>Subtotal: {(subtotal() / 100).toFixed(2)}</p>
      <p>Tax: {(tax() / 100).toFixed(2)}</p>
      <p>Total: {(total() / 100).toFixed(2)}</p>
    </section>
  );
}
