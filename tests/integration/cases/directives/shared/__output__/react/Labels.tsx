import Badge from "./Badge";
import Tag from "./Tag";
import type { ComponentPropsWithRef } from "react";

export type LabelsAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Labels({ className, style, ...attributes }: LabelsAttributes) {
  return (
    <section className={cx("labels", className)} aria-label="Labels" style={style} {...attributes}>
      <Badge label="New" />
      <Tag name="docs" />
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
