import { computed } from "vue";

export function useTotal(price: () => number, quantity: () => number) {
  const total = computed(() => price() * quantity());
  const label = computed(() => `${quantity()} × ${price()} = ${total.value}`);

  return { total, label };
}
