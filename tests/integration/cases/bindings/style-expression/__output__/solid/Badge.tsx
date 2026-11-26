import { styleProperties } from "./_unframework/styleProperties";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export default function Badge(
  props: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "tone", "class", "style"]);

  return (
    <span
      class={props.class ? `badge ${props.class}` : "badge"}
      style={{ ...styleProperties(props.tone), ...props.style }}
      {...others}
    >
      {props.label}
    </span>
  );
}
