import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface SaveButtonEvents {
  onSave?: () => void;
}

export function SaveButton(
  props: SaveButtonEvents &
    Omit<ComponentProps<"button">, "style" | "onClick"> & {
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["onSave", "onClick"]);

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
