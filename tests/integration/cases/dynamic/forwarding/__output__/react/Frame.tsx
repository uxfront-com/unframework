import Card from "./Card";
import Panel from "./Panel";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface FrameSlots {
  title?: ReactNode;
}

export type FrameAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "label" | "wide" | "title" | "children"
>;

export default function Frame({
  label,
  wide,
  title,
  className,
  style,
  ...attributes
}: { label: string; wide: boolean } & FrameSlots & FrameAttributes) {
  const Tag = wide ? Panel : Card;

  return (
    <section className={cx("frame", className)} aria-label={label} style={style} {...attributes}>
      <Tag title={title} />
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
