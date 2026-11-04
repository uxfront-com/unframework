import { onMounted, onUnmounted, ref } from "vue";

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
