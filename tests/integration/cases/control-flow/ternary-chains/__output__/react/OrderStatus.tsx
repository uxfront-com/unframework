import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: OrderStatusProps & OrderStatusAttributes) {
  return (
    <p className={cx("order-status", className)} style={style} {...scopeAttributes(attributes)}>
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
