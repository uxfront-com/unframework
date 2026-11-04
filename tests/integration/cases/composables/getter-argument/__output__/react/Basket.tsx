import { useTotal } from "./useTotal";
import { type CSSProperties, useRef, useState } from "react";

export interface BasketAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <section
      className={cx("basket", className)}
      aria-label="Basket"
      style={style}
      {...scopeAttributes(attributes)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
