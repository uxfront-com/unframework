import { $, type QRL, type ReadonlySignal, useComputed$, useSignal } from "@qwik.dev/core";

export function useControllableState<T>(
  value: ReadonlySignal<T | undefined>,
  initial: T,
  onChange: QRL<(next: T) => void>,
) {
  const local = useSignal<T>(initial);
  const current = useComputed$(() => value.value ?? local.value);

  const set = $((next: T) => {
    local.value = next;
    void onChange(next);
  });

  return { current, set };
}
