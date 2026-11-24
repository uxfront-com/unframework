import type { ButtonProps } from "./types";
import type { ComponentPropsWithRef } from "react";

export type ButtonAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "disabled" | "label" | "id" | "children"
>;

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
      {...attributes}
    >
      {label}
    </button>
  );
}
