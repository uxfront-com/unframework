import type { ComponentPropsWithRef } from "react";
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

export type ChipAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "tone" | "children">;

export default function Chip({
  label,
  tone,
  className,
  style,
  ...attributes
}: { label: string; tone?: "plain" | "accent" } & ChipAttributes) {
  return (
    <span className={cx(chip(tone), className)} style={style} {...attributes}>
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
