import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { ButtonProps } from "./types";
import type { CSSProperties } from "react";

export interface ButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Button({
  id,
  label,
  disabled = false,
  className,
  style,
  ...attributes
}: ButtonProps & ButtonAttributes) {
  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </button>
  );
}
