import { $, useComputed$, useSignal } from "@qwik.dev/core";

export function useCart() {
  const items = useSignal(0);
  const empty = useComputed$(() => items.value === 0);

  const add = $((count: number) => {
    items.value += count;
  });

  const clear = $(() => {
    items.value = 0;
  });

  return { items, empty, add, clear };
}
