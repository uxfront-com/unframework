import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Continue.uf.tsx.css";

export default function Continue(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

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
