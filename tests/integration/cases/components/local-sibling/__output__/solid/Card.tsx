import { CardIcon } from "./CardIcon";
import type { JSX } from "solid-js";

export default function Card(
  props: { title: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class ? `card ${props.class}` : "card"} style={props.style}>
      <CardIcon symbol="+" />
      <h3>{props.title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}
