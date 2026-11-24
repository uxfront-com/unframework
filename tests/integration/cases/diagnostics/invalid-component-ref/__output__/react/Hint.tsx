import type { ComponentPropsWithRef } from "react";

export type HintAttributes = Omit<ComponentPropsWithRef<"small">, "text" | "children">;

export function Hint({ text, className, style, ...attributes }: { text: string } & HintAttributes) {
  return (
    <small className={cx("hint", className)} style={style} {...attributes}>
      {text}
    </small>
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
