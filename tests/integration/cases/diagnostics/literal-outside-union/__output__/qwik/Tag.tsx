import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export type Tone = "info" | "warning";

export default component$<
  { tone: Tone } & Omit<PropsOf<"span">, "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ tone, class: className, style, ...attributes }) => {
  return (
    <span class={["tag", tone, className]} style={style} {...attributes}>
      {tone}
    </span>
  );
});
