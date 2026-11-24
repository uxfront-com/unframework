import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Hint = component$<
  Omit<PropsOf<"p">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <p class={className} style={style} {...attributes}>
      Hint
    </p>
  );
});
