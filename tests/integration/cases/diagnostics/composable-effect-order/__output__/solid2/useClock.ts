import { createState } from "./_unframework/createState";
import { onSettled } from "solid-js";

export function useClock() {
  const [started, setStarted] = createState(false);

  onSettled(() => {
    setStarted(true);
  });

  return { started };
}
