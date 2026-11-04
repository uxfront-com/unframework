import { computed } from "@angular/core";

export function useTotal(price: () => number, quantity: () => number) {
  const total = computed(() => price() * quantity());

  const label = computed(() => `${quantity()} × ${price()} = ${total()}`);

  return { total, label };
}
