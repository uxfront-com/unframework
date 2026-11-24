import Section from "./Section";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { name: string } & Omit<PropsOf<"article">, "name" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, class: className, style, ...attributes }) => {
  return (
    <article aria-label="Profile" class={className} style={style} {...attributes}>
      <Section title={`About ${name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${name}.`} />
    </article>
  );
});
