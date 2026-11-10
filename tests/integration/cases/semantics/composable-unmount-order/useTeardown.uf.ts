// A composable with an unmount hook (ADR-0069): it runs when the component that called it
// unmounts, once for each call, and reads the caller's name through a getter as it goes.
import { computed, onUnmounted } from "unframework";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const title = computed(() => `Panel ${name()}`);

  onUnmounted(() => report(`${name()} closed`));

  return { title };
}
