import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Item = component$<
  Omit<PropsOf<"span">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <span class={className} style={style} {...attributes}>
      Item
    </span>
  );
});
