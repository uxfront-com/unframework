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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
