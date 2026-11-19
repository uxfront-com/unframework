import { onMounted, ref, watch } from "vue";

export function useTracked(report: (entry: string) => void) {
  const count = ref(0);

  watch(count, () => report("composable watcher"));

  onMounted(() => report("composable mounted"));

  function increment() {
    count.value++;
  }

  return { count, increment };
}
