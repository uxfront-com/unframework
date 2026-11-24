import Heading from "./Heading";
import type { ComponentPropsWithRef } from "react";

export type SectionAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "title" | "body" | "children"
>;

export default function Section({
  title,
  body,
  className,
  style,
  ...attributes
}: { title: string; body: string } & SectionAttributes) {
  return (
    <section className={cx("section", className)} style={style} {...attributes}>
      <Heading text={title} />
      <p>{body}</p>
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
