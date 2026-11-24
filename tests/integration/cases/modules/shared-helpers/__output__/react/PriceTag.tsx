import { formatPrice, pluralise } from "./format";
import { type ComponentPropsWithRef, useMemo, useRef, useState } from "react";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export type PriceTagAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "cents" | "onOrder" | "children"
>;

export default function PriceTag({
  cents,
  onOrder,
  className,
  style,
  ...attributes
}: { cents: number } & PriceTagEvents & PriceTagAttributes) {
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const total = useMemo(() => formatPrice(cents * quantity), [cents, quantity]);

  function currentTotal() {
    return formatPrice(cents * quantityRef.current);
  }

  function order() {
    onOrder?.(`${pluralise(quantityRef.current, "item")} for ${currentTotal()}`);
  }

  return (
    <section
      className={cx("price-tag", className)}
      aria-label="Price"
      style={style}
      {...attributes}
    >
      <p>Each: {formatPrice(cents)}</p>
      <p role="status">
        {pluralise(quantity, "item")}: {total}
      </p>
      <button
        type="button"
        onClick={() => {
          quantityRef.current++;
          setQuantity(quantityRef.current);
        }}
      >
        One more
      </button>
      <button type="button" onClick={order}>
        Order
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
