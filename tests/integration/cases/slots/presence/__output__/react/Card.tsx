import type { ComponentPropsWithRef, ReactNode } from "react";

export interface CardSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export type CardAttributes = Omit<ComponentPropsWithRef<"section">, "label" | "title" | "children">;

export default function Card({
  label,
  title,
  children,
  className,
  style,
  ...attributes
}: { label: string } & CardSlots & CardAttributes) {
  return (
    <section className={cx("card", className)} aria-label={label} style={style} {...attributes}>
      {title != null ? <header className="title">{title}</header> : null}
      {children != null ? <div className="body">{children}</div> : <p>Empty card</p>}
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
