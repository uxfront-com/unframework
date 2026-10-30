// A composable with a watcher and a mounted hook (ADR-0069), each reporting through its caller's
// callback, so the caller can see where they run among its own.
import { onMounted, ref, watch } from "unframework";

export function useTracked(report: (entry: string) => void) {
  const count = ref(0);

  watch(count, () => report("composable watcher"));

  onMounted(() => report("composable mounted"));

  function increment() {
    count.value++;
  }

  return { count, increment };
}
