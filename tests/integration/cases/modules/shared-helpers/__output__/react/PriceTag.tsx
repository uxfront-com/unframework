import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { formatPrice, pluralise } from "./format";
import { type CSSProperties, useMemo, useRef, useState } from "react";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export interface PriceTagAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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
