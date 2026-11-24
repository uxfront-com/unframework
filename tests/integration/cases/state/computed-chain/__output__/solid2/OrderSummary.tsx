import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export default function OrderSummary(
  props: OrderSummaryProps &
    Omit<ComponentProps<"section">, "price" | "taxRate" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "price", "taxRate", "class");

  const [quantity, setQuantity] = createState(1);
  const subtotal = () => quantity() * props.price;
  const tax = () => Math.round(subtotal() * props.taxRate);
  const total = () => subtotal() + tax();
  const tier = () => {
    if (total() >= 10000) return "bulk";
    return "standard";
  };

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
