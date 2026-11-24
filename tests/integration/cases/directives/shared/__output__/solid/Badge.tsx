import { vMark } from "./vMark";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface BadgeProps {
  label: string;
}

export default function Badge(
  props: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      ref={vMark(() => "badge")}
      {...others}
    >
      {props.label}
    </span>
  );
}
