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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
