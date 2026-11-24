import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface SaveButtonEvents {
  onSave?: () => void;
}

export function SaveButton(
  props: SaveButtonEvents &
    Omit<ComponentProps<"button">, "class" | "style" | "onClick"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const others = omit(props, "onSave", "onClick");

  return (
    <button
      type="button"
      onClick={(event) => {
        props.onSave?.();
        props.onClick?.(event);
      }}
      {...others}
    >
      Save
    </button>
  );
}
