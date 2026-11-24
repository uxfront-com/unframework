import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Heading(
  props: { text: string } & Omit<ComponentProps<"h3">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <h3 class={props.class ? `heading ${props.class}` : "heading"} {...others}>
      {props.text}
    </h3>
  );
}
