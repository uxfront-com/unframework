import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { label: string } & Omit<PropsOf<"li">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <li class={["item", className]} style={style} {...attributes}>
      {label}
    </li>
  );
});
