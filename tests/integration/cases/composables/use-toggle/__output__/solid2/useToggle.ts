import { createState } from "./_unframework/createState";

export function useToggle(initial: boolean) {
  const [on, setOn] = createState(initial);

  function toggle() {
    setOn(!on());
  }

  function close() {
    setOn(false);
  }

  return { on, toggle, close };
}
