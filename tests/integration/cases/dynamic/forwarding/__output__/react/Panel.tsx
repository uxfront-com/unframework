import type { CSSProperties, ReactNode } from "react";

export interface PanelSlots {
  title?: ReactNode;
}

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ title, className, style }: PanelSlots & PanelAttributes) {
  return (
    <div className={cx("panel", className)} style={style}>
      <h4>{title ?? "Untitled"}</h4>
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
