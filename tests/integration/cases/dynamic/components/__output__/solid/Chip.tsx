import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Chip(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <span class={props.class ? `chip ${props.class}` : "chip"} {...others}>
      {props.label}
    </span>
  );
}
