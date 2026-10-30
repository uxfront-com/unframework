// A composable shared by every component that opens and closes something (ADR-0069): a ref of
// state, and the functions that change it.
import { ref } from "unframework";

export function useToggle(initial: boolean) {
  const on = ref(initial);

  function toggle() {
    on.value = !on.value;
  }

  function close() {
    on.value = false;
  }

  return { on, toggle, close };
}
