import type { CSSProperties } from "react";

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ text, className, style }: { text: string } & PanelAttributes) {
  return (
    <aside className={cx("panel", className)} style={style} data-uf-48dda3f4="">
      <p className="text" data-uf-48dda3f4="">
        {text}
      </p>
    </aside>
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
