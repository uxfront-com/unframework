import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface CardSlots {
  header?: JSX.Element;
  children?: JSX.Element;
  footer?: JSX.Element;
}

export default function Card(
  props: CardSlots &
    Omit<ComponentProps<"article">, "header" | "children" | "footer" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "header", "children", "footer", "class");

  return (
    <article class={props.class ? `card ${props.class}` : "card"} {...others}>
      <header>{props.header}</header>
      <div class="body">{props.children}</div>
      <footer>{props.footer}</footer>
    </article>
  );
}
