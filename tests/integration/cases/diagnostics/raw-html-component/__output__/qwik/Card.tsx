import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export const Card = component$<
  { heading: string } & Omit<PropsOf<"section">, "heading" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ heading, class: className, style, ...attributes }) => {
  return (
    <section class={["card", className]} style={style} {...attributes}>
      <h2>{heading}</h2>
    </section>
  );
});
