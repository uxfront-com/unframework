import Card from "./Card";
import type { JSX } from "solid-js";

export default function Cards(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={props.class ? `cards ${props.class}` : "cards"} style={props.style}>
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
}
