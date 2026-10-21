import type { JSX } from "solid-js";

export interface FrameSlots {
  children?: JSX.Element;
}

export default function Frame(props: FrameSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <figure
      class={props.class ? `frame ${props.class}` : "frame"}
      data-uf-9dc516fd=""
      style={props.style}
    >
      {props.children}
    </figure>
  );
}
