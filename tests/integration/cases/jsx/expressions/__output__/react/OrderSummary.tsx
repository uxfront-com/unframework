import type { CSSProperties } from "react";

export interface OrderSummaryProps {
  customer: string;
  orderNumber: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  coupon?: string;
}

export interface OrderSummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function OrderSummary({
  customer,
  orderNumber,
  unitPrice,
  quantity,
  discount,
  coupon,
  className,
  style,
}: OrderSummaryProps & OrderSummaryAttributes) {
  return (
    <section className={cx("order-summary", className)} aria-label="Order summary" style={style}>
      <h2>Order {String(orderNumber).padStart(6, "0")}</h2>
      <p>Customer: {customer.trim().toUpperCase()}</p>
      <p>{`${quantity} item${quantity === 1 ? "" : "s"} at ${unitPrice.toFixed(2)} each`}</p>
      <p>Subtotal: {(unitPrice * quantity).toFixed(2)}</p>
      <p>Discount: {Math.min(Math.max(discount, 0), 50)}%</p>
      <p>
        Total: {(unitPrice * quantity * (1 - Math.min(Math.max(discount, 0), 50) / 100)).toFixed(2)}
      </p>
      <p>
        {quantity > 10 ? "Bulk order" : "Standard order"}, {coupon ? "coupon applied" : "no coupon"}
      </p>
      <p>Points earned: {Math.round(unitPrice * quantity) % 100}</p>
    </section>
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
