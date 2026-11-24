import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export type { Tone } from "./tone";

export default component$<
  { label: string } & Omit<PropsOf<"span">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <span class={["badge", className]} style={style} {...attributes}>
      {label}
    </span>
  );
});
