// The composable the component calls: it changes its state through the functions it returns.
import { ref } from "unframework";

export function useToggle(initial: boolean) {
  const on = ref(initial);

  function toggle() {
    on.value = !on.value;
  }

  return { on, toggle };
}
