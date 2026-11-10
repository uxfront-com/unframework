import { onMount } from "svelte";

export function useClock() {
  let started = $state(false);

  onMount(() => {
    started = true;
  });

  return {
    get started() {
      return started;
    },
  };
}
