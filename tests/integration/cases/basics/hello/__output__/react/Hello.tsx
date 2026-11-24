import type { ComponentPropsWithRef } from "react";

export type HelloAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export default function Hello({ className, style, ...attributes }: HelloAttributes) {
  return (
    <p className={cx("greeting", className)} style={style} {...attributes}>
      Hello, world!
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
