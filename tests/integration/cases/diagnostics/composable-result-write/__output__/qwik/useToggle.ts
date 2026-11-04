import { $, useSignal } from "@qwik.dev/core";

export function useToggle(initial: boolean) {
  const on = useSignal(initial);

  const toggle = $(() => {
    on.value = !on.value;
  });

  return { on, toggle };
}
