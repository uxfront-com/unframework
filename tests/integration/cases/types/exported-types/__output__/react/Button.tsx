import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export type ButtonAttributes = Omit<ComponentPropsWithRef<"button">, "label" | "tone" | "children">;

export default function Button({
  label,
  tone = "primary",
  className,
  style,
  ...attributes
}: ButtonProps & ButtonAttributes) {
  return (
    <button
      type="button"
      className={cx(`button button-${tone}`, className)}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
}
