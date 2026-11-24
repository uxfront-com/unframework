import type { ButtonProps } from "./types";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export default function Button(
  rawProps: ButtonProps &
    Omit<ComponentProps<"button">, "disabled" | "label" | "id" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps({ disabled: false } satisfies Partial<ButtonProps>, rawProps);
  const [, others] = splitProps(props, ["disabled", "label", "id"]);

  return (
    <button id={props.id} type="button" disabled={props.disabled} {...others}>
      {props.label}
    </button>
  );
}
