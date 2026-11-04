import { createSignal } from "solid-js";

const step = 1;

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const [count, setCount] = createSignal(0);

  function increment() {
    setCount(count() + step);
    if (count() === limit) onLimit(count());
  }

  function reset() {
    setCount(0);
  }

  return { count, step, increment, reset };
}
