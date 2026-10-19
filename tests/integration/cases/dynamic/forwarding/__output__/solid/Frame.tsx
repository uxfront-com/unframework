import Card from "./Card";
import Panel from "./Panel";
import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

export interface FrameSlots {
  title?: JSX.Element;
}

export default function Frame(
  props: { label: string; wide: boolean } & FrameSlots & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <section
      class={props.class ? `frame ${props.class}` : "frame"}
      aria-label={props.label}
      style={props.style}
    >
      <Dynamic component={props.wide ? Panel : Card} title={props.title} />
    </section>
  );
}
