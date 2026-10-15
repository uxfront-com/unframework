import Card from "./Card";
import type { JSX } from "solid-js";

export default function Post(
  props: { author: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Card
      header={<h2>Release notes</h2>}
      footer={<small>By {props.author}</small>}
      class={props.class}
      style={props.style}
    >
      <p>Slots arrive in M3.</p>
    </Card>
  );
}
