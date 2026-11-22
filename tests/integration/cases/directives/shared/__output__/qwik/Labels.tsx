import Badge from "./Badge";
import Tag from "./Tag";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <section class={["labels", className]} aria-label="Labels" style={style} {...attributes}>
      <Badge label="New" />
      <Tag name="docs" />
    </section>
  );
});
