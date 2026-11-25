import { createState } from "./_unframework/createState";

export function useToggle(initial: boolean) {
  const [on, setOn] = createState(initial);

  function toggle() {
    setOn(!on());
  }

  return { on, toggle };
}
