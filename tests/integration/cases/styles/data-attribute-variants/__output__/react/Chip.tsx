import type { ComponentPropsWithRef } from "react";
import "./Chip.uf.tsx.css";

export type ChipAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "label" | "variant" | "pressed" | "children"
>;

export default function Chip({
  label,
  variant = "neutral",
  pressed = false,
  className,
  style,
  ...attributes
}: { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & ChipAttributes) {
  return (
    <button
      type="button"
      className={cx("chip", className)}
      data-variant={variant}
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed ? "true" : "false"}
      style={style}
      data-uf-69db3802=""
      {...attributes}
    >
      {label}
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
