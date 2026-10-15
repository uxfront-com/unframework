import type { CSSProperties, ReactNode } from "react";

export interface BoxSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface BoxAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Box({ title, children, className, style }: BoxSlots & BoxAttributes) {
  return (
    <div className={cx("box", className)} style={style}>
      <h3>{title ?? "Untitled"}</h3>
      {children ?? <p>No content</p>}
    </div>
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
