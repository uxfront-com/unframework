import { signal } from "@angular/core";

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const count = signal(0);

  const step = 1;

  function increment() {
    count.set(count() + step);
    if (count() === limit) onLimit(count());
  }

  function reset() {
    count.set(0);
  }

  return { count: count.asReadonly(), step, increment, reset };
}
