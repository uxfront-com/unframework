import Hint from "./Hint";
import type { JSX } from "solid-js";

export default function Banner(
  props: { tip: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `banner ${props.class}` : "banner"}
      data-uf-e25060c2=""
      style={props.style}
    >
      <Hint text={props.tip} data-uf-e25060c2="" />
    </div>
  );
}
