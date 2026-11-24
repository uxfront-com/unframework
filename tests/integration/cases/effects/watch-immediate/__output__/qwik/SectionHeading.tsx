import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface SectionHeadingProps {
  title: string;
}

export interface SectionHeadingEvents {
  onChange$?: QRL<(title: string, previous?: string) => void>;
  onReady$?: QRL<() => void>;
}

export default component$<
  SectionHeadingProps &
    SectionHeadingEvents &
    Omit<PropsOf<"h2">, "title" | "onChange$" | "onReady$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, onChange$, onReady$, class: className, style, ...attributes }) => {
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

  return (
    <h2 class={["section-heading", className]} style={style} {...attributes}>
      {title}
    </h2>
  );
});
