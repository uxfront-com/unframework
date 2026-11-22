import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { title: string } & Omit<PropsOf<"button">, "title" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, class: className, style, ...attributes }) => {
  return (
    <button type="button" class={["button", className]} style={style} {...attributes}>
      {title}
    </button>
  );
});
