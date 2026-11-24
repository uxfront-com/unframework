import type { ButtonProps } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export default function Button(
  rawProps: ButtonProps &
    Omit<ComponentProps<"button">, "disabled" | "label" | "id" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get disabled() {
      return rawProps.disabled === undefined ? false : rawProps.disabled;
    },
  });
  const others = omit(props, "disabled", "label", "id");

  return (
    <button id={props.id} type="button" disabled={props.disabled} {...others}>
      {props.label}
    </button>
  );
}
