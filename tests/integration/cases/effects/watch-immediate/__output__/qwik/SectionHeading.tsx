import { type QRL, component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

export interface SectionHeadingProps {
  title: string;
}

export interface SectionHeadingEvents {
  onChange$?: QRL<(title: string, previous?: string) => void>;
  onReady$?: QRL<() => void>;
}

export default component$<SectionHeadingProps & SectionHeadingEvents>(
  ({ title, onChange$, onReady$ }) => {
    const previousTitle = useSignal<{ value: typeof title }>();
    useTask$(
      ({ track }) => {
        const value = track(() => title);
        const last = previousTitle.value;
        if (last && Object.is(value, last.value)) return;
        previousTitle.value = { value };
        const previous = last?.value;
        onChange$?.(value, previous);
      },
      { deferUpdates: false },
    );

    useVisibleTask$(
      () => {
        onReady$?.();
      },
      { strategy: "document-ready" },
    );

    return <h2 class="section-heading">{title}</h2>;
  },
);
