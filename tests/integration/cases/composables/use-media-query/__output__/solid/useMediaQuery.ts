import { createSignal, onCleanup, onMount } from "solid-js";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = createSignal(false);
  let list: MediaQueryList | undefined;

  function update() {
    setMatches(list?.matches ?? false);
  }

  onMount(() => {
    list = window.matchMedia(query);
    update();
    list.addEventListener("change", update);
  });

  onMount(() =>
    onCleanup(() => {
      list?.removeEventListener("change", update);
    }),
  );

  return { matches };
}
