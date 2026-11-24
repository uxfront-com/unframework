import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function TransitionComponent(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  return (
    <p class={props.class ? `note ${props.class}` : "note"} {...others}>
      Plain child
    </p>
  );
}
