import { type ComponentProps, type JSX, splitProps } from "solid-js";

export type { Tone } from "./tone";

export default function Badge(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} {...others}>
      {props.label}
    </span>
  );
}
