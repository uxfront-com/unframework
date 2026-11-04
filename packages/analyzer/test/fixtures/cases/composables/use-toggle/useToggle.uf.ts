import { ref } from "unframework";

export function useToggle(initial: boolean) {
  const on = ref(initial);
  function toggle() {
    on.value = !on.value;
  }
  return { on, toggle };
}
