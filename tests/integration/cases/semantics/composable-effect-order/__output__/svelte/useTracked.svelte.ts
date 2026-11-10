import { onMount, untrack } from "svelte";

export function useTracked(report: (entry: string) => void) {
  let count = $state(0);

  let previousCount = untrack(() => count);
  $effect.pre(() => {
    if (Object.is(count, previousCount)) return;
    previousCount = count;
    untrack(() => {
      report("composable watcher");
    });
  });

  onMount(() => {
    report("composable mounted");
  });

  function increment() {
    count++;
  }

  return {
    get count() {
      return count;
    },
    increment,
  };
}
