import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
  useSignal,
  useTask$,
} from "@qwik.dev/core";

export interface PageCountProps {
  page?: number;
  total: number;
}

export interface PageCountEvents {
  onPageChange$?: QRL<(page: number, previous: number) => void>;
}

export default component$<
  PageCountProps &
    PageCountEvents &
    Omit<PropsOf<"nav">, "page" | "total" | "onPageChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ page = 1, total, onPageChange$, class: className, style, ...attributes }) => {
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
    <nav class={["page-count", className]} aria-label="Pages" style={style} {...attributes}>
      <p role="status">{label.value}</p>
      <p>Direct: {page}</p>
    </nav>
  );
});
