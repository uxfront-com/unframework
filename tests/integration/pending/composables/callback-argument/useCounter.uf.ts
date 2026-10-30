// A composable that calls back its caller (ADR-0069): the callback is a function client code
// calls, here each time the count reaches its limit, with the count it reached.
import { ref } from "unframework";

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const count = ref(0);

  function increment() {
    count.value += 1;
    if (count.value === limit) onLimit(count.value);
  }

  function reset() {
    count.value = 0;
  }

  return { count, increment, reset };
}
