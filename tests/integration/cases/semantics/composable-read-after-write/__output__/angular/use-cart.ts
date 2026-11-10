import { computed, signal } from "@angular/core";

export function useCart() {
  const items = signal(0);

  const empty = computed(() => items() === 0);

  function add(count: number) {
    items.set(items() + count);
  }

  function clear() {
    items.set(0);
  }

  return { items: items.asReadonly(), empty, add, clear };
}
