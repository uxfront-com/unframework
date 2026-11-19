import { computed, shallowRef } from "vue";

export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  const local = shallowRef<T>(initial);
  const current = computed(() => value() ?? local.value);

  function set(next: T) {
    local.value = next;
    onChange(next);
  }

  return { current, set };
}
