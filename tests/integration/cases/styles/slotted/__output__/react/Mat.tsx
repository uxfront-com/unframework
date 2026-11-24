import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Mat.uf.tsx.css";

export interface MatSlots {
  children?: ReactNode;
}

export type MatAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Mat({
  children,
  className,
  style,
  ...attributes
}: MatSlots & MatAttributes) {
  return (
    <div className={cx("mat", className)} style={style} data-uf-09929c4a="" {...attributes}>
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
