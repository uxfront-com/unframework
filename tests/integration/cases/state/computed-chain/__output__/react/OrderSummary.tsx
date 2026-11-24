import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useMemo, useRef, useState } from "react";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export type OrderSummaryAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "price" | "taxRate" | "children"
>;

export default function OrderSummary({
  price,
  taxRate,
  className,
  style,
  ...attributes
}: OrderSummaryProps & OrderSummaryAttributes) {
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const subtotal = useMemo(() => quantity * price, [quantity, price]);
  const tax = useMemo(() => Math.round(subtotal * taxRate), [subtotal, taxRate]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);
  const tier = useMemo(() => {
    if (total >= 10000) return "bulk";
    return "standard";
  }, [total]);

  return (
    <section
      className={cx("order-summary", className)}
      aria-label="Order summary"
      data-tier={tier}
      style={style}
      {...attributes}
    >
      <p role="status">Quantity: {quantity}</p>
      <button
        type="button"
        disabled={quantity === 1}
        onClick={() => {
          quantityRef.current--;
          setQuantity(quantityRef.current);
        }}
      >
        Remove one
      </button>
      <button
        type="button"
        onClick={() => {
          quantityRef.current++;
          setQuantity(quantityRef.current);
        }}
      >
        Add one
      </button>
      <p>Subtotal: {(subtotal / 100).toFixed(2)}</p>
      <p>Tax: {(tax / 100).toFixed(2)}</p>
      <p>Total: {(total / 100).toFixed(2)}</p>
    </section>
  );
}
