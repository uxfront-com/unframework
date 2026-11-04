// A composable that calls back its caller (ADR-0069): the callback is a function client code
// calls, here each time the count reaches its limit, with the count it reached. It also returns
// a constant, its step.
import { ref } from "unframework";

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const count = ref(0);
  const step = 1;

  function increment() {
    count.value += step;
    if (count.value === limit) onLimit(count.value);
  }

  function reset() {
    count.value = 0;
  }

  return { count, step, increment, reset };
}
