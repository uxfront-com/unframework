import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { label: string } & Omit<PropsOf<"div">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <div class={["card", className]} style={style} {...attributes}>
      <strong>{label}</strong>
    </div>
  );
});
