import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Base(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <button type="button" class={props.class ? `base ${props.class}` : "base"} {...others}>
      {props.text}
    </button>
  );
}
