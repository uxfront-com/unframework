import Frame from "./Frame";
import type { JSX } from "solid-js";

export default function Gallery(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={props.class} style={props.style}>
      <Frame label="Card" wide={false} title={"Sunset"} />
      <Frame label="Panel" wide={true} title={"Dawn"} />
      <Frame label="Empty" wide={true} />
    </div>
  );
}
