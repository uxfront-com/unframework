import { useTotal } from "./useTotal";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type BasketAttributes = Omit<ComponentPropsWithRef<"section">, "price" | "children">;

export default function Basket({
  price,
  className,
  style,
  ...attributes
}: { price: number } & BasketAttributes) {
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const { total, label } = useTotal(
    () => price,
    () => quantity,
  );

  return (
    <section className={cx("basket", className)} aria-label="Basket" style={style} {...attributes}>
      <p role="status">Total: {total}</p>
      <p>{label}</p>
      <button
        type="button"
        onClick={() => {
          quantityRef.current++;
          setQuantity(quantityRef.current);
        }}
      >
        Add one
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
