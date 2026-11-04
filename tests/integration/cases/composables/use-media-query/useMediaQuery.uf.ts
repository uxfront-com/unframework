// Whether a media query matches (ADR-0069): false on the server, read from the browser once the
// caller mounts, and kept current by a listener the caller's unmount removes.
import { onMounted, onUnmounted, ref } from "unframework";

export function useMediaQuery(query: string) {
  const matches = ref(false);
  let list: MediaQueryList | undefined;

  function update() {
    matches.value = list?.matches ?? false;
  }

  onMounted(() => {
    list = window.matchMedia(query);
    update();
    list.addEventListener("change", update);
  });

  onUnmounted(() => {
    list?.removeEventListener("change", update);
  });

  return { matches };
}
