import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
import "./Card.uf.tsx.css";

export default function Card(
  props: { title: string } & Omit<ComponentProps<"article">, "title" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["title", "class"]);

  return (
    <article
      class={cx("card", button({ size: "lg", tone: "primary" }), props.class)}
      data-uf-9cfb6163=""
      {...others}
    >
      <h2 class="title" data-uf-9cfb6163="">
        {props.title}
      </h2>
    </article>
  );
}
