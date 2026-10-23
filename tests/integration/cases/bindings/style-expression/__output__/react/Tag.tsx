import type { CSSProperties } from "react";

export interface TagProps {
  label: string;
  tone?: string;
}

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({ label, className, style, ...attributes }: TagProps & TagAttributes) {
  return (
    <em
      className={cx("tag", className)}
      style={{ color: "rgb(120, 30, 30)", padding: "1px 4px", ...style }}
      {...scopeAttributes(attributes)}
    >
      {label}
    </em>
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
