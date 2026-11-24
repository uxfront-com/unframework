import type { ComponentPropsWithRef } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "tone" | "children">;

export function Badge({
  tone,
  className,
  style,
  ...attributes
}: { tone: "info" | "warning" } & BadgeAttributes) {
  return (
    <span className={cx("badge", tone, className)} style={style} {...attributes}>
      {tone}
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
