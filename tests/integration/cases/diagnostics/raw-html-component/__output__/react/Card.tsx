import type { ComponentPropsWithRef } from "react";

export type CardAttributes = Omit<ComponentPropsWithRef<"section">, "heading" | "children">;

export function Card({
  heading,
  className,
  style,
  ...attributes
}: { heading: string } & CardAttributes) {
  return (
    <section className={cx("card", className)} style={style} {...attributes}>
      <h2>{heading}</h2>
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
