import { vMark } from "./vMark";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface BadgeProps {
  label: string;
}

export default function Badge(
  props: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

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
