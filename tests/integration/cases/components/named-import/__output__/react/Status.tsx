import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import type { ComponentPropsWithRef } from "react";

export type StatusAttributes = Omit<ComponentPropsWithRef<"p">, "state" | "children">;

export default function Status({
  state,
  className,
  style,
  ...attributes
}: { state: string } & StatusAttributes) {
  return (
    <p className={cx("status", className)} style={style} {...attributes}>
      <Badge text="Build" />
      <Tag text={state} />
    </p>
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
