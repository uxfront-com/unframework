import type { ComponentPropsWithRef } from "react";

export type HeaderAttributes = Omit<ComponentPropsWithRef<"header">, "children">;

export function Header({ className, style, ...attributes }: HeaderAttributes) {
  return (
    <header className={cx("header", className)} style={style} {...attributes}>
      Site
    </header>
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
