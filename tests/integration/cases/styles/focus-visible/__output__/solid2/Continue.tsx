import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Continue.uf.tsx.css";

export default function Continue(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <button
      type="button"
      class={props.class ? `continue ${props.class}` : "continue"}
      data-uf-bb3adc28=""
      {...others}
    >
      {props.text}
    </button>
  );
}
