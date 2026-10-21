import type { CSSProperties, ReactNode } from "react";

export interface FrameSlots {
  children?: ReactNode;
}

export interface FrameAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Frame({ children, className, style }: FrameSlots & FrameAttributes) {
  return (
    <figure className={cx("frame", className)} style={style} data-uf-9dc516fd="">
      {children}
    </figure>
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
