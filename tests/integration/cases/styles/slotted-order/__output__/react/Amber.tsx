import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Amber.uf.tsx.css";

export interface AmberSlots {
  children?: ReactNode;
}

export type AmberAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Amber({
  children,
  className,
  style,
  ...attributes
}: AmberSlots & AmberAttributes) {
  return (
    <div className={cx("amber", className)} style={style} data-uf-c97301b3="" {...attributes}>
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
