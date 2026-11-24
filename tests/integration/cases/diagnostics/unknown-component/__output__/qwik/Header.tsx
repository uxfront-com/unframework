import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Header = component$<
  Omit<PropsOf<"header">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <header class={["header", className]} style={style} {...attributes}>
      Site
    </header>
  );
});
