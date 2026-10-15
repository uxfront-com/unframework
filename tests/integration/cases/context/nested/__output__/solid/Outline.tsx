import Level from "./Level";
import type { JSX } from "solid-js";

export default function Outline(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <Level title="Book" class={props.class} style={props.style}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}
