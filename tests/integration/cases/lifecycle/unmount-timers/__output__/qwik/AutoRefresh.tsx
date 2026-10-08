import { $, type QRL, component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

export interface AutoRefreshEvents {
  onRefresh$?: QRL<(count: number) => void>;
}

export default component$<AutoRefreshProps & AutoRefreshEvents>(({ interval, onRefresh$ }) => {
  const enabled = useSignal(false);
  const timer = useSignal<ReturnType<typeof setInterval> | undefined>();
  const refreshes = useSignal(0);

  const tick = $(() => {
    refreshes.value += 1;
    onRefresh$?.(refreshes.value);
  });

  const toggle = $(() => {
    if (enabled.value) {
      clearInterval(timer.value);
      enabled.value = false;
    } else {
      timer.value = setInterval(tick, interval);
      enabled.value = true;
    }
  });

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        clearInterval(timer.value);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section class="auto-refresh" aria-label="Auto-refresh">
      <button type="button" aria-pressed={enabled.value} onClick$={toggle}>
        Auto-refresh
      </button>
      <p role="status">{enabled.value ? "Refreshing" : "Paused"}</p>
    </section>
  );
});
