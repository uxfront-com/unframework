// A composable whose functions write its state (ADR-0069): its caller reads the returned ref
// right after calling one, in the same client code.
import { computed, ref } from "unframework";

export function useCart() {
  const items = ref(0);
  const empty = computed(() => items.value === 0);

  function add(count: number) {
    items.value += count;
  }

  function clear() {
    items.value = 0;
  }

  return { items, empty, add, clear };
}
