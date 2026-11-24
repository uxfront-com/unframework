import Heading from "./Heading";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Section(
  props: { title: string; body: string } & Omit<
    ComponentProps<"section">,
    "title" | "body" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "title", "body", "class");

  return (
    <section class={props.class ? `section ${props.class}` : "section"} {...others}>
      <Heading text={props.title} />
      <p>{props.body}</p>
    </section>
  );
}
