import type { CSSProperties } from "react";

export interface ProgressAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Progress({
  label,
  className,
  style,
}: { label: string } & ProgressAttributes) {
  return (
    <div className={cx("progress", className)} style={style} data-uf-0738d8af="">
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
