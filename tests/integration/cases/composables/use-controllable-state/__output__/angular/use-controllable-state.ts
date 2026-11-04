import { computed, signal } from "@angular/core";

export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  const local = signal<T>(initial);

  const current = computed(() => value() ?? local());

  function set(next: T) {
    local.set(next);
    onChange(next);
  }

  return { current, set };
}
