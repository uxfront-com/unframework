import { type QRL, component$, useComputed$, useSignal, useTask$ } from "@qwik.dev/core";

export interface PageCountProps {
  page?: number;
  total: number;
}

export interface PageCountEvents {
  onPageChange$?: QRL<(page: number, previous: number) => void>;
}

export default component$<PageCountProps & PageCountEvents>(
  ({ page = 1, total, onPageChange$ }) => {
    const label = useComputed$(() => `Page ${page} of ${total}`);

    const previousPage = useSignal(() => page);
    useTask$(
      ({ track }) => {
        const next = track(() => page);
        const previous = previousPage.value;
        if (Object.is(next, previous)) return;
        previousPage.value = next;
        onPageChange$?.(next, previous);
      },
      { deferUpdates: false },
    );

    return (
      <nav class="page-count" aria-label="Pages">
        <p role="status">{label.value}</p>
        <p>Direct: {page}</p>
      </nav>
    );
  },
);
