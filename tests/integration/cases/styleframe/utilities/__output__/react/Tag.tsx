import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";

export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Tag({
  label,
  className,
  style,
  ...attributes
}: { label: string } & TagAttributes) {
  return (
    <span
      className={cx(
        "_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]",
        className,
      )}
      style={style}
      {...attributes}
    >
      {label}
    </span>
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
