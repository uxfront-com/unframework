import { styleProperties } from "./_unframework/styleProperties";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export default function Badge(
  props: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "tone", "class", "style");

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
