import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Pill(
  props: { text: string } & Omit<ComponentProps<"span">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <span class={props.class ? `pill ${props.class}` : "pill"} {...others}>
      {props.text}
    </span>
  );
}
