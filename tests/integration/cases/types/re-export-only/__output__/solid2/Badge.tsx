import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export type { Tone } from "./tone";

export default function Badge(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} {...others}>
      {props.label}
    </span>
  );
}
