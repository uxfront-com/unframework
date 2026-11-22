import type { ComponentPropsWithRef } from "react";

export type Tone = "info" | "warning";

export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "tone" | "children">;

export default function Tag({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & TagAttributes) {
  return (
    <span className={cx("tag", tone, className)} style={style} {...attributes}>
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
