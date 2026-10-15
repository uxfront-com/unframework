import Heading from "./Heading";
import type { JSX } from "solid-js";

export default function Section(
  props: { title: string; body: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section class={props.class ? `section ${props.class}` : "section"} style={props.style}>
      <Heading text={props.title} />
      <p>{props.body}</p>
    </section>
  );
}
