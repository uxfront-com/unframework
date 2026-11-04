import { type QRL, type ReadonlySignal, useComputed$, useVisibleTask$ } from "@qwik.dev/core";

export function useTeardown(name: ReadonlySignal<string>, report: QRL<(entry: string) => void>) {
  const title = useComputed$(() => `Panel ${name.value}`);

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        report(`${name.value} closed`);
      });
    },
    { strategy: "document-ready" },
  );

  return { title };
}
