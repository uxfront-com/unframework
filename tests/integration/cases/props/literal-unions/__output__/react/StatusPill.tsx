import type { CSSProperties } from "react";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export interface StatusPillAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function StatusPill({
  status,
  size = "small",
  level = 1,
  className,
  style,
  ...attributes
}: StatusPillProps & StatusPillAttributes) {
  return (
    <span
      className={cx("pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}
      {level === 3 ? " (critical)" : ""}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
