import { type CSSProperties, useMemo, useRef, useState } from "react";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

export interface CheckoutTotalEvents {
  onShippingChange?: (method: ShippingMethod) => void;
}

export interface CheckoutTotalAttributes {
  className?: string;
  style?: CSSProperties;
}

const rates = { standard: 0, express: 1200 };

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default function CheckoutTotal({
  subtotal,
  onShippingChange,
  className,
  style,
}: CheckoutTotalProps & CheckoutTotalEvents & CheckoutTotalAttributes) {
  const [method, setMethod] = useState<ShippingMethod>("standard");
  const methodRef = useRef(method);
  const shipping = useMemo(() => rates[method], [method]);
  const total = useMemo(() => formatCents(subtotal + shipping), [subtotal, shipping]);

  function choose(next: ShippingMethod) {
    methodRef.current = next;
    setMethod(methodRef.current);
    onShippingChange?.(next);
  }

  const chooseExpress = () => {
    choose("express");
  };

  function chooseStandard() {
    choose("standard");
  }

  return (
    <section className={cx("checkout-total", className)} aria-label="Order total" style={style}>
      <p>Subtotal: {formatCents(subtotal)}</p>
      <p>Shipping: {formatCents(shipping)}</p>
      <p role="status">Total: {total}</p>
      <button type="button" aria-pressed={method === "standard"} onClick={chooseStandard}>
        Standard shipping
      </button>
      <button type="button" aria-pressed={method === "express"} onClick={chooseExpress}>
        Express shipping
      </button>
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
