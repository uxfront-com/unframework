// A composable whose getter parameters it reads reactively (ADR-0069): the total follows every
// change of what the caller's getters read, a prop or the caller's own state.
import { computed } from "unframework";

export function useTotal(price: () => number, quantity: () => number) {
  const total = computed(() => price() * quantity());
  const label = computed(() => `${quantity()} × ${price()} = ${total.value}`);

  return { total, label };
}
