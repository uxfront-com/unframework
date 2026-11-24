import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ChipEvents {
  onPick?: (label: string) => void;
}

export default function Chip(
  props: { label: string } & ChipEvents &
    Omit<ComponentProps<"button">, "label" | "class" | "style" | "onClick"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const others = omit(props, "label", "onPick", "class", "onClick");

  return (
    <button
      type="button"
      class={props.class ? `chip ${props.class}` : "chip"}
      onClick={(event) => {
        props.onPick?.(props.label);
        props.onClick?.(event);
      }}
      {...others}
    >
      {props.label}
    </button>
  );
}
