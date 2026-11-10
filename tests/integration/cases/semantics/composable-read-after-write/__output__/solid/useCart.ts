import { createMemo, createSignal } from "solid-js";

export function useCart() {
  const [items, setItems] = createSignal(0);
  const empty = createMemo(() => items() === 0);

  function add(count: number) {
    setItems(items() + count);
  }

  function clear() {
    setItems(0);
  }

  return { items, empty, add, clear };
}
