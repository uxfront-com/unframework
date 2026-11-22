import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"p">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <p class={["note", className]} style={style} {...attributes}>
      Plain child
    </p>
  );
});
