import { createMemo, createSignal } from "solid-js";

export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  const [local, setLocal] = createSignal<T>(initial);
  const current = createMemo(() => value() ?? local());

  function set(next: T) {
    setLocal(() => next);
    onChange(next);
  }

  return { current, set };
}
