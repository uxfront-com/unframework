import { $, type QRL, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

export function useTracked(report: QRL<(entry: string) => void>) {
  const count = useSignal(0);

  const previousCount = useSignal(() => count.value);
  useTask$(
    ({ track }) => {
      const value = track(count);
      if (Object.is(value, previousCount.value)) return;
      previousCount.value = value;
      report("composable watcher");
    },
    { deferUpdates: false },
  );

  useVisibleTask$(
    () => {
      report("composable mounted");
    },
    { strategy: "document-ready" },
  );

  const increment = $(() => {
    count.value++;
  });

  return { count, increment };
}
