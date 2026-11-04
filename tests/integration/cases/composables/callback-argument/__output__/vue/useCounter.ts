import { ref } from "vue";

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
