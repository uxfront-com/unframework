import { computed, ref } from "vue";

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
