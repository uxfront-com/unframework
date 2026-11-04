import { $, type QRL, useSignal } from "@qwik.dev/core";

const step = 1;

export function useCounter(limit: number, onLimit: QRL<(count: number) => void>) {
  const count = useSignal(0);

  const increment = $(() => {
    count.value += step;
    if (count.value === limit) void onLimit(count.value);
  });

  const reset = $(() => {
    count.value = 0;
  });

  return { count, step, increment, reset };
}
