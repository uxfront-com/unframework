import Steps from "./Steps";
import type { JSX } from "solid-js";

export default function Recipe(
  props: { steps: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style}>
      <Steps steps={props.steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}
