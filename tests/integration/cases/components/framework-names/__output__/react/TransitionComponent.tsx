import type { CSSProperties } from "react";

export interface TransitionComponentAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TransitionComponent({ className, style }: TransitionComponentAttributes) {
  return (
    <p className={cx("note", className)} style={style}>
      Plain child
    </p>
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
