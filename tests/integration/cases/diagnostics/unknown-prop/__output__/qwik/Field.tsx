import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Field = component$<
  { label: string } & Omit<PropsOf<"label">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <label class={className} style={style} {...attributes}>
      {label} <input type="text" />
    </label>
  );
});
