import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type Signal,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  { label: string } & Omit<PropsOf<"input">, "label" | "class" | "style" | "ref"> & {
      class?: ClassList;
      style?: CSSProperties;
      ref?: Signal<Element | undefined>;
    }
>(({ label, class: className, style, onFocus$, ref, ...attributes }) => {
  const input = useSignal<HTMLInputElement>();
  const mounted = useSignal(false);

  useVisibleTask$(
    () => {
      mounted.value = (input.value ?? null) !== null;
    },
    { strategy: "document-ready" },
  );

  const fill = $(() => {
    if (input.value && !input.value.value && mounted.value) input.value.value = "Ada";
  });

  return (
    <input
      ref={(element) => {
        input.value = element;
        if (ref) ref.value = element;
      }}
      name="name"
      aria-label={label}
      onFocus$={[fill, onFocus$]}
      class={className}
      style={style}
      {...attributes}
    />
  );
});
