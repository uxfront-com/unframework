import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Badge(
  props: { text: string } & Omit<ComponentProps<"span">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} {...others}>
      {props.text}
    </span>
  );
}
