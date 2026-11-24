import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { title: string } & Omit<PropsOf<"section">, "title" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, class: className, style, ...attributes }) => {
  return (
    <section class={["panel", className]} aria-label={title} style={style} {...attributes}>
      <h2>{title}</h2>
      <Slot />
    </section>
  );
});
