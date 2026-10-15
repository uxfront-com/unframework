import type { CSSProperties } from "react";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export interface OrderStatusAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function OrderStatus({
  status,
  carrier,
  eta,
  className,
  style,
}: OrderStatusProps & OrderStatusAttributes) {
  return (
    <p className={cx("order-status", className)} style={style}>
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
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
