import { cx } from "./_unframework/cx";
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
