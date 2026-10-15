import Base from "./Base";
import type { CSSProperties } from "react";

export interface PrimaryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Primary({ text, className, style }: { text: string } & PrimaryAttributes) {
  return <Base text={text} className={cx("primary", className)} style={style} />;
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
