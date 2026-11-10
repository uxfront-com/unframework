import { onMount } from "svelte";

export function useMediaQuery(query: string) {
  let matches = $state(false);
  let list: MediaQueryList | undefined;

  function update() {
    matches = list?.matches ?? false;
  }

  onMount(() => {
    list = window.matchMedia(query);
    update();
    list.addEventListener("change", update);
  });

  onMount(() => () => {
    list?.removeEventListener("change", update);
  });

  return {
    get matches() {
      return matches;
    },
  };
}
