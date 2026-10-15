import Box from "./Box";
import type { JSX } from "solid-js";

export interface FrameSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Frame(
  props: { label: string } & FrameSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `frame ${props.class}` : "frame"}
      aria-label={props.label}
      style={props.style}
    >
      <Box children={props.children} title={props.title} />
    </section>
  );
}
