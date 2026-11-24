import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Badge = component$<
  { tone: "info" | "warning" } & Omit<PropsOf<"span">, "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ tone, class: className, style, ...attributes }) => {
  return (
    <span class={["badge", tone, className]} style={style} {...attributes}>
      {tone}
    </span>
  );
});
