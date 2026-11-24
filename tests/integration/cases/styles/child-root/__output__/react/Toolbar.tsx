import Button from "./Button";
import type { ComponentPropsWithRef } from "react";
import "./Toolbar.uf.tsx.css";

export type ToolbarAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Toolbar({ className, style, ...attributes }: ToolbarAttributes) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      className={cx("toolbar", className)}
      style={style}
      data-uf-a33d603f=""
      {...attributes}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
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
