import type { ComponentPropsWithRef, ReactNode } from "react";

export interface CardSlots {
  title?: ReactNode;
}

export type CardAttributes = Omit<ComponentPropsWithRef<"div">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...attributes}>
      <h3>{title ?? "Untitled"}</h3>
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
