import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

export interface PriceTagAttributes {
  className?: string;
  style?: CSSProperties;
}

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default function PriceTag({
  price,
  className,
  style,
  ...attributes
}: PriceTagProps & PriceTagAttributes) {
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);
  const [unit, setUnit] = useState(() => formatCents(price));
  const unitRef = useRef(unit);
  const total = useMemo(() => formatCents(price * quantity), [price, quantity]);
  const [last, setLast] = useState("none");
  const lastRef = useRef(last);

  function describe(): string {
    return `${quantity} at ${formatCents(price)}`;
  }

  function currentDescribe(): string {
    return `${quantityRef.current} at ${formatCents(price)}`;
  }

  const [summary, setSummary] = useState(() => describe());
  const summaryRef = useRef(summary);

  const previousQuantity = useRef(quantity);
  const onQuantityChange = useEffectEvent(() => {
    lastRef.current = currentDescribe();
    setLast(lastRef.current);
  });
  useEffect(() => {
    const previous = previousQuantity.current;
    if (Object.is(previous, quantity)) return;
    previousQuantity.current = quantity;
    onQuantityChange();
  }, [quantity]);

  function add() {
    quantityRef.current++;
    setQuantity(quantityRef.current);
    summaryRef.current = currentDescribe();
    setSummary(summaryRef.current);
  }

  return (
    <section
      className={cx("price-tag", className)}
      aria-label="Price"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p>Unit: {unit}</p>
      <p role="status">{summary}</p>
      <p>Total: {total}</p>
      <p>Last change: {last}</p>
      <button type="button" onClick={add}>
        Add one
      </button>
      <button
        type="button"
        onClick={() => {
          unitRef.current = formatCents(price * 2);
          setUnit(unitRef.current);
        }}
      >
        Price two
      </button>
    </section>
  );
}
