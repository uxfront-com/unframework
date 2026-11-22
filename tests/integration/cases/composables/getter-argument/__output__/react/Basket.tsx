import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
