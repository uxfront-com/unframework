import type { JSX } from "solid-js";

export default function Transition(
  props: { step: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p class={props.class ? `step ${props.class}` : "step"} style={props.style}>
      Step: {props.step}
    </p>
  );
}
