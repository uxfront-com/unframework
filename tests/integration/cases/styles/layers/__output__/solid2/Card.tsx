import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Card.uf.tsx.css";

export default function Card(
  props: { title: string } & Omit<ComponentProps<"section">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "class");

  return (
    <section class={props.class ? `card ${props.class}` : "card"} data-uf-bb60e985="" {...others}>
      <h2 class="title" data-uf-bb60e985="">
        {props.title}
      </h2>
    </section>
  );
}
