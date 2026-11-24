import Heading from "./Heading";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Section(
  props: { title: string; body: string } & Omit<
    ComponentProps<"section">,
    "title" | "body" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "body", "class"]);

  return (
    <section class={props.class ? `section ${props.class}` : "section"} {...others}>
      <Heading text={props.title} />
      <p>{props.body}</p>
    </section>
  );
}
