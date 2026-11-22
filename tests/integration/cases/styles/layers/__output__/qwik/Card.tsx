import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Card.uf.tsx.css?inline";

export default component$<
  { title: string } & Omit<PropsOf<"section">, "title" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <section class={["card", className]} data-uf-bb60e985="" style={style} {...attributes}>
      <h2 class="title" data-uf-bb60e985="">
        {title}
      </h2>
    </section>
  );
});
