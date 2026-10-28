// Composables (ADR-0069): named `use*` exports with value, getter or callback parameters, returning a
// shorthand object.
import { computed, ref, watch } from "unframework";

export function useToggle(initial: boolean) {
  const on = ref(initial);
  const label = computed(() => (on.value ? "On" : "Off"));

  function toggle() {
    on.value = !on.value;
  }

  return { on, label, toggle };
}

export function useControllableState(value: () => string, onChange: (next: string) => void) {
  const current = ref(value());
  watch(value, (next) => (current.value = next));

  function set(next: string) {
    current.value = next;
    onChange(next);
  }

  return { current, set };
}
