import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Blue.uf.tsx.css";

export interface BlueSlots {
  children?: ReactNode;
}

export type BlueAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Blue({
  children,
  className,
  style,
  ...attributes
}: BlueSlots & BlueAttributes) {
  return (
    <div className={cx("blue", className)} style={style} data-uf-721c504a="" {...attributes}>
      {children}
    </div>
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
