import { useLayoutEffect, useMemo, useRef, useState } from "react";

export function useTotal(price: () => number, quantity: () => number) {
  const priceRef = useRef(price);
  const quantityRef = useRef(quantity);
  useLayoutEffect(() => {
    priceRef.current = price;
    quantityRef.current = quantity;
  });

  const total = useMemo(() => price() * quantity(), [price, quantity]);

  const [currentTotal] = useState(() => () => priceRef.current() * quantityRef.current());

  const label = useMemo(() => `${quantity()} × ${price()} = ${total}`, [quantity, price, total]);

  const [currentLabel] = useState(
    () => () => `${quantityRef.current()} × ${priceRef.current()} = ${currentTotal()}`,
  );

  return { total, currentTotal, label, currentLabel };
}
