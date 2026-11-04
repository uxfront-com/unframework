import { computed, onUnmounted } from "vue";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const title = computed(() => `Panel ${name()}`);

  onUnmounted(() => report(`${name()} closed`));

  return { title };
}
