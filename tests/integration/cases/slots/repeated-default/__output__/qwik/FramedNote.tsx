import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { title: string } & Omit<PropsOf<"article">, "title" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, class: className, style, ...attributes }) => {
  return (
    <article class={["framed-note", className]} style={style} {...attributes}>
      <header>
        <Slot />
      </header>
      <p>{title}</p>
      <footer>
        <Slot />
      </footer>
    </article>
  );
});
