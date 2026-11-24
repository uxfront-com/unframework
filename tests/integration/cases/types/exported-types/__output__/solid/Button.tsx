import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export default function Button(
  rawProps: ButtonProps &
    Omit<ComponentProps<"button">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const props = mergeProps({ tone: "primary" } satisfies Partial<ButtonProps>, rawProps);
  const [, others] = splitProps(props, ["label", "tone", "class"]);

  return (
    <button type="button" class={cx(`button button-${props.tone}`, props.class)} {...others}>
      {props.label}
    </button>
  );
}
