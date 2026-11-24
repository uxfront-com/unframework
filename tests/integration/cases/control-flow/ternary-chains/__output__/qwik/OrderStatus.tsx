import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default component$<
  OrderStatusProps &
    Omit<PropsOf<"p">, "status" | "carrier" | "eta" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ status, carrier, eta, class: className, style, ...attributes }) => {
  return (
    <p class={["order-status", className]} style={style} {...attributes}>
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
});
