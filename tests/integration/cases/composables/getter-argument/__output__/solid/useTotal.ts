import { createMemo } from "solid-js";

export function useTotal(price: () => number, quantity: () => number) {
  const total = createMemo(() => price() * quantity());
  const label = createMemo(() => `${quantity()} × ${price()} = ${total()}`);

  return { total, label };
}
