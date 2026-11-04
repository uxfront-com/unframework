import { useSignal, useVisibleTask$ } from "@qwik.dev/core";

export function useClock() {
  const started = useSignal(false);

  useVisibleTask$(
    () => {
      started.value = true;
    },
    { strategy: "document-ready" },
  );

  return { started };
}
