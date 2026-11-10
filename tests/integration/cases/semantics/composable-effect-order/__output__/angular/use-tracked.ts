import { afterNextRender, computed, effect, signal, untracked } from "@angular/core";

export function useTracked(report: (entry: string) => void) {
  const count = signal(0);

  const currentCount = computed(() => count());
  let watching = false;
  effect(() => {
    currentCount();
    if (!watching) {
      watching = true;
      return;
    }
    untracked(() => report("composable watcher"));
  });

  afterNextRender(() => {
    report("composable mounted");
  });

  function increment() {
    count.set(count() + 1);
  }

  return { count: count.asReadonly(), increment };
}
