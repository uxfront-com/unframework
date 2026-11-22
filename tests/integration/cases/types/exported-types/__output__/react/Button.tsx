import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export interface ButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    >
      {label}
    </button>
  );
}
