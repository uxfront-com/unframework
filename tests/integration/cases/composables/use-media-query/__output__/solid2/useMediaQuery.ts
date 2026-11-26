import { createState } from "./_unframework/createState";
import { onSettled } from "solid-js";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = createState(false);
  let list: MediaQueryList | undefined;

  function update() {
    setMatches(list?.matches ?? false);
  }

  onSettled(() => {
    list = window.matchMedia(query);
    update();
    list.addEventListener("change", update);
  });

  onSettled(() => () => {
    list?.removeEventListener("change", update);
  });

  return { matches };
}
