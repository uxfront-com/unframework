import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"p">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  useVisibleTask$(
    () => {
      throw new Error("The chart could not start");
    },
    { strategy: "document-ready" },
  );

  return (
    <p class={className} style={style} {...attributes}>
      Chart
    </p>
  );
});
