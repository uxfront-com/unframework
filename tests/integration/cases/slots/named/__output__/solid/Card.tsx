import type { JSX } from "solid-js";

export interface CardSlots {
  header?: JSX.Element;
  children?: JSX.Element;
  footer?: JSX.Element;
}

export default function Card(props: CardSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <article class={props.class ? `card ${props.class}` : "card"} style={props.style}>
      <header>{props.header}</header>
      <div class="body">{props.children}</div>
      <footer>{props.footer}</footer>
    </article>
  );
}
