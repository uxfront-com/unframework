import Rows from "./Rows";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface WrapperSlots {
  row?: ReactNode;
}

export type WrapperAttributes = Omit<ComponentPropsWithRef<"section">, "row" | "children">;

export default function Wrapper({
  row,
  className,
  style,
  ...attributes
}: WrapperSlots & WrapperAttributes) {
  return (
    <section className={cx("wrapper", className)} aria-label="Rows" style={style} {...attributes}>
      <Rows row={row} />
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
