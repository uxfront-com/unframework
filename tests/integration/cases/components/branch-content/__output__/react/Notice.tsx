import type { CSSProperties } from "react";

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  text,
  tone,
  className,
  style,
}: { text: string; tone: "info" | "quiet" } & NoticeAttributes) {
  return (
    <p role="status" className={cx("notice", tone, className)} style={style}>
      {text}
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
