import type { Sized, Toned } from "./types";
import type { ComponentPropsWithRef } from "react";

type ChipProps = Sized & Toned & { label: string };

export type ChipAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "size" | "tone" | "label" | "children"
>;

export default function Chip({
  size,
  tone = "neutral",
  label,
  className,
  style,
  ...attributes
}: ChipProps & ChipAttributes) {
  return (
    <span className={cx(`chip chip-${size} chip-${tone}`, className)} style={style} {...attributes}>
      {label}
    </span>
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
