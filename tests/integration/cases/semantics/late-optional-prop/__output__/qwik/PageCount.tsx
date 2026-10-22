import {
  type CSSProperties,
  type ClassList,
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
  PageCountProps & PageCountEvents & { class?: ClassList; style?: CSSProperties }
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
    <nav
      class={["page-count", className]}
      aria-label="Pages"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <p role="status">{label.value}</p>
      <p>Direct: {page}</p>
    </nav>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
