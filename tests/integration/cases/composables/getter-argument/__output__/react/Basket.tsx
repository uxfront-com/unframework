import { cx } from "./_unframework/cx";
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
