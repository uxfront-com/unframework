import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { label: string } & Omit<PropsOf<"span">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <span class={["chip", className]} style={style} {...attributes}>
      {label}
    </span>
  );
});
