import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface OnceSlotSlots {
  text?: (props: { label: string }) => JSX.Element;
}

export default function OnceSlot(
  props: { label: string } & OnceSlotSlots &
    Omit<ComponentProps<"span">, "label" | "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "text", "class");

  return (
    <span class={props.class ? `once-slot ${props.class}` : "once-slot"} {...others}>
      {props.text?.({ label: props.label })}
    </span>
  );
}
