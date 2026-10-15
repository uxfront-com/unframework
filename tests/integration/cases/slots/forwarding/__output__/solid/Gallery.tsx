import Frame from "./Frame";
import type { JSX } from "solid-js";

export default function Gallery(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={props.class} style={props.style}>
      <Frame label="Filled" title={"Sunset"}>
        <p>Taken at dusk.</p>
      </Frame>
      <Frame label="Empty" />
    </div>
  );
}
