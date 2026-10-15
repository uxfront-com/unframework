import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import type { JSX } from "solid-js";

export default function Status(
  props: { state: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p class={props.class ? `status ${props.class}` : "status"} style={props.style}>
      <Badge text="Build" />
      <Tag text={props.state} />
    </p>
  );
}
