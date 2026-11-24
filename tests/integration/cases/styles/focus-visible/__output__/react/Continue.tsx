import type { ComponentPropsWithRef } from "react";
import "./Continue.uf.tsx.css";

export type ContinueAttributes = Omit<ComponentPropsWithRef<"button">, "text" | "children">;

export default function Continue({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ContinueAttributes) {
  return (
    <button
      type="button"
      className={cx("continue", className)}
      style={style}
      data-uf-bb3adc28=""
      {...attributes}
    >
      {text}
    </button>
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
