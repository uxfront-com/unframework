import { type CSSProperties, useMemo, useRef, useState } from "react";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export interface OrderSummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
