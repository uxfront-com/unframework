import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Action.uf.tsx.css";

export default function Action(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

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
