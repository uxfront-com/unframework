import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: OrderSummaryProps & OrderSummaryAttributes) {
  return (
    <section
      className={cx("order-summary", className)}
      aria-label="Order summary"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
