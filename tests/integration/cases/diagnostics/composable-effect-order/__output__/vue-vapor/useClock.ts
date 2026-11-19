import { onMounted, ref } from "vue";

export function useClock() {
  const started = ref(false);

  onMounted(() => {
    started.value = true;
  });

  return { started };
}
