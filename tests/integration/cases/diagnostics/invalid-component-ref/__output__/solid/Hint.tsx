import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Hint(
  props: { text: string } & Omit<ComponentProps<"small">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <small class={props.class ? `hint ${props.class}` : "hint"} {...others}>
      {props.text}
    </small>
  );
}
