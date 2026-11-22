import type { ComponentPropsWithRef } from "react";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Badge({
  label,
  className,
  style,
  ...attributes
}: { label: string } & BadgeAttributes) {
  return (
    <span className={cx(badge(), className)} style={style} {...attributes}>
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
