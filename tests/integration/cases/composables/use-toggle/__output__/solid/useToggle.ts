import { createSignal } from "solid-js";

export function useToggle(initial: boolean) {
  const [on, setOn] = createSignal(initial);

  function toggle() {
    setOn(!on());
  }

  function close() {
    setOn(false);
  }

  return { on, toggle, close };
}
