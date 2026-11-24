import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Heading(
  props: { tag: "h1" | "h2" | "h3"; text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Dynamic
      component={props.tag}
      class={props.class ? `heading ${props.class}` : "heading"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </Dynamic>
  );
}
