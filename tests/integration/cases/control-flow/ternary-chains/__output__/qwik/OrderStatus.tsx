import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default component$<OrderStatusProps & { class?: ClassList; style?: CSSProperties }>(
  ({ status, carrier, eta, class: className, style }) => {
    return (
      <p class={["order-status", className]} style={style}>
        {status === "pending" ? (
          "Waiting for payment."
        ) : status === "shipped" ? (
          <>
            <strong>Shipped</strong> with {carrier ?? "our courier"}, arriving {eta ?? "soon"}.
          </>
        ) : status === "delivered" ? (
          <strong>Delivered</strong>
        ) : (
          <em>Cancelled</em>
        )}
      </p>
    );
  },
);
