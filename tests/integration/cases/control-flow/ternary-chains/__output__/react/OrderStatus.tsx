import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export type OrderStatusAttributes = Omit<
  ComponentPropsWithRef<"p">,
  "status" | "carrier" | "eta" | "children"
>;

export default function OrderStatus({
  status,
  carrier,
  eta,
  className,
  style,
  ...attributes
}: OrderStatusProps & OrderStatusAttributes) {
  return (
    <p className={cx("order-status", className)} style={style} {...attributes}>
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
