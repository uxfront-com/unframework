import type { ComponentPropsWithRef } from "react";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

export type ButtonAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "label" | "size" | "tone" | "children"
>;

export default function Button({
  label,
  size,
  tone,
  className,
  style,
  ...attributes
}: { label: string; size?: "sm" | "lg"; tone?: "neutral" | "primary" } & ButtonAttributes) {
  return (
    <button
      type="button"
      className={cx(button({ size, tone }), className)}
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
