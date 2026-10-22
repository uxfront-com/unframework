import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export default component$<OrderStatusProps & { class?: ClassList; style?: CSSProperties }>(
  ({ status, carrier, eta, class: className, style, ...attributes }) => {
    return (
      <p class={["order-status", className]} {...scopeAttributes(attributes)} style={style}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
