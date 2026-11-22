import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Pill = component$<
  { text: string } & Omit<PropsOf<"span">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <span class={["pill", className]} style={style} {...attributes}>
      {text}
    </span>
  );
});
