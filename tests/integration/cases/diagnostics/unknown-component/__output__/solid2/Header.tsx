import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function Header(
  props: Omit<ComponentProps<"header">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  return (
    <header class={props.class ? `header ${props.class}` : "header"} {...others}>
      Site
    </header>
  );
}
