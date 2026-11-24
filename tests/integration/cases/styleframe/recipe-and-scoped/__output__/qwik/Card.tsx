import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
import styles from "./Card.uf.tsx.css?inline";

export default component$<
  { title: string } & Omit<PropsOf<"article">, "title" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <article
      class={["card", button({ size: "lg", tone: "primary" }), className]}
      data-uf-9cfb6163=""
      style={style}
      {...attributes}
    >
      <h2 class="title" data-uf-9cfb6163="">
        {title}
      </h2>
    </article>
  );
});
