import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface OrderSummaryProps {
  customer: string;
  orderNumber: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  coupon?: string;
}

export default function OrderSummary(
  props: OrderSummaryProps &
    Omit<
      ComponentProps<"section">,
      | "customer"
      | "orderNumber"
      | "unitPrice"
      | "quantity"
      | "discount"
      | "coupon"
      | "class"
      | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(
    props,
    "customer",
    "orderNumber",
    "unitPrice",
    "quantity",
    "discount",
    "coupon",
    "class",
  );

  return (
    <section
      class={props.class ? `order-summary ${props.class}` : "order-summary"}
      aria-label="Order summary"
      {...others}
    >
      <h2>Order {String(props.orderNumber).padStart(6, "0")}</h2>
      <p>Customer: {props.customer.trim().toUpperCase()}</p>
      <p>{`${props.quantity} item${props.quantity === 1 ? "" : "s"} at ${props.unitPrice.toFixed(2)} each`}</p>
      <p>Subtotal: {(props.unitPrice * props.quantity).toFixed(2)}</p>
      <p>Discount: {Math.min(Math.max(props.discount, 0), 50)}%</p>
      <p>
        Total:{" "}
        {(
          props.unitPrice *
          props.quantity *
          (1 - Math.min(Math.max(props.discount, 0), 50) / 100)
        ).toFixed(2)}
      </p>
      <p>
        {props.quantity > 10 ? "Bulk order" : "Standard order"},{" "}
        {props.coupon ? "coupon applied" : "no coupon"}
      </p>
      <p>Points earned: {Math.round(props.unitPrice * props.quantity) % 100}</p>
    </section>
  );
}
