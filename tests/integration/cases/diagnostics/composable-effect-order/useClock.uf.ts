// The composable the component calls: its mounted hook runs code in the browser.
import { onMounted, ref } from "unframework";

export function useClock() {
  const started = ref(false);

  onMounted(() => {
    started.value = true;
  });

  return { started };
}
