import { CardIcon } from "./CardIcon";
import type { ComponentPropsWithRef } from "react";

export type CardAttributes = Omit<ComponentPropsWithRef<"div">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <div className={cx_1("card", className)} style={style} {...attributes}>
      <CardIcon symbol="+" />
      <h3>{title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx_1(...parts: unknown[]): string {
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
