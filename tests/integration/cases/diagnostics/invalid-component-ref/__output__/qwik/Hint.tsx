import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Hint = component$<
  { text: string } & Omit<PropsOf<"small">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <small class={["hint", className]} style={style} {...attributes}>
      {text}
    </small>
  );
});
