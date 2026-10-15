import Primary from "./Primary";
import type { JSX } from "solid-js";

export default function Toolbar(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div role="toolbar" aria-label="Actions" class={props.class} style={props.style}>
      <Primary text="Save" class="wide" />
    </div>
  );
}
