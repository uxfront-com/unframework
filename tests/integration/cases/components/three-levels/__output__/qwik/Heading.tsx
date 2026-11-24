import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { text: string } & Omit<PropsOf<"h3">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <h3 class={["heading", className]} style={style} {...attributes}>
      {text}
    </h3>
  );
});
