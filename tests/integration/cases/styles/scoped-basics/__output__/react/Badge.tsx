import type { CSSProperties } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  label,
  count,
  className,
  style,
}: { label: string; count: number } & BadgeAttributes) {
  return (
    <span className={cx("badge", className)} style={style} data-uf-d9cef2e7="">
      <span className="label" data-uf-d9cef2e7="">
        {label}
      </span>
      <span className="count" data-uf-d9cef2e7="">
        {count}
      </span>
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
