import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Hint(
  props: { text: string } & Omit<ComponentProps<"p">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <p class={props.class ? `hint ${props.class}` : "hint"} {...others}>
      Tip: <span class="uf-highlight">{props.text}</span>
    </p>
  );
}
