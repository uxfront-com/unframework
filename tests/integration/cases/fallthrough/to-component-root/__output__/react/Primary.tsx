import Base from "./Base";
import type { ComponentPropsWithRef } from "react";

export type PrimaryAttributes = Omit<ComponentPropsWithRef<typeof Base>, "text" | "children">;

export default function Primary({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PrimaryAttributes) {
  return <Base text={text} className={cx("primary", className)} style={style} {...attributes} />;
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
