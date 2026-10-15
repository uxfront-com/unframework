import Base from "./Base";
import type { JSX } from "solid-js";

export default function Primary(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Base
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      style={props.style}
    />
  );
}
