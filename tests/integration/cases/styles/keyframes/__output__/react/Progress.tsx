import type { CSSProperties } from "react";
import "./Progress.uf.tsx.css";

export interface ProgressAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Progress({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ProgressAttributes) {
  return (
    <div
      className={cx("progress", className)}
      style={style}
      data-uf-0738d8af=""
      {...scopeAttributes(attributes)}
    >
      <span className="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{label}</span>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
