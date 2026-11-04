// A value a parent may control or leave to the component (ADR-0069), generic over the value
// (ADR-0068): the getter reads the parent's value reactively, the component's own state holds it
// while the parent passes none, and the callback tells the parent of every change.
import { computed, ref } from "unframework";

export function useControllableState<T>(
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
) {
  const local = ref<T>(initial);
  const current = computed(() => value() ?? local.value);

  function set(next: T) {
    local.value = next;
    onChange(next);
  }

  return { current, set };
}
