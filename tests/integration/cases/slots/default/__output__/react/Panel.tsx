import type { CSSProperties, ReactNode } from "react";

export interface PanelSlots {
  children?: ReactNode;
}

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  title,
  children,
  className,
  style,
}: { title: string } & PanelSlots & PanelAttributes) {
  return (
    <section className={cx("panel", className)} aria-label={title} style={style}>
      <h2>{title}</h2>
      {children}
    </section>
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
