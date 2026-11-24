import type { ComponentPropsWithRef } from "react";

export interface ChipEvents {
  onPick?: (label: string) => void;
}

export type ChipAttributes = Omit<ComponentPropsWithRef<"button">, "label" | "onPick" | "children">;

export default function Chip({
  label,
  onPick,
  className,
  style,
  onClick,
  ...attributes
}: { label: string } & ChipEvents & ChipAttributes) {
  return (
    <button
      type="button"
      className={cx("chip", className)}
      onClick={(event) => {
        onPick?.(label);
        onClick?.(event);
      }}
      style={style}
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
