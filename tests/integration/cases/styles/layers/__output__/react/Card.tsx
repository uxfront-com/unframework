import type { ComponentPropsWithRef } from "react";
import "./Card.uf.tsx.css";

export type CardAttributes = Omit<ComponentPropsWithRef<"section">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <section className={cx("card", className)} style={style} data-uf-bb60e985="" {...attributes}>
      <h2 className="title" data-uf-bb60e985="">
        {title}
      </h2>
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
