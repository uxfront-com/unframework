import type { CSSProperties } from "react";

export interface ActionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Action({ text, className, style }: { text: string } & ActionAttributes) {
  return (
    <button type="button" className={cx("action", className)} style={style} data-uf-6173c12c="">
      {text}
    </button>
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
