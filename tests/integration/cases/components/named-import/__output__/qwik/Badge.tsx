import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Badge = component$<
  { text: string } & Omit<PropsOf<"span">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <span class={["badge", className]} style={style} {...attributes}>
      {text}
    </span>
  );
});
