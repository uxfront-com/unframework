import { shallowRef } from "vue";

export function useToggle(initial: boolean) {
  const on = shallowRef(initial);

  function toggle() {
    on.value = !on.value;
  }

  return { on, toggle };
}
