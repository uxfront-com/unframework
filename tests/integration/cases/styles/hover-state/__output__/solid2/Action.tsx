import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Action.uf.tsx.css";

export default function Action(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <button
      type="button"
      class={props.class ? `action ${props.class}` : "action"}
      data-uf-6173c12c=""
      {...others}
    >
      {props.text}
    </button>
  );
}
