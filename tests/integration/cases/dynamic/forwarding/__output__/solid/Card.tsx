import type { JSX } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
}

export default function Card(props: CardSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={props.class ? `card ${props.class}` : "card"} style={props.style}>
      <h3>{props.title ?? "Untitled"}</h3>
    </div>
  );
}
