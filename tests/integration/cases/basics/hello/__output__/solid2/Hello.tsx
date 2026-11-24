import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Hello(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  return (
    <p class={props.class ? `greeting ${props.class}` : "greeting"} {...others}>
      Hello, world!
    </p>
  );
}
