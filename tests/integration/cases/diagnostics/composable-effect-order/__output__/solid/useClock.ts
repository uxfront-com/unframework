import { createSignal, onMount } from "solid-js";

export function useClock() {
  const [started, setStarted] = createSignal(false);

  onMount(() => {
    setStarted(true);
  });

  return { started };
}
