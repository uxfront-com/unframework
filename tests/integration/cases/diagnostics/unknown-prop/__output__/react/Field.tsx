import type { ComponentPropsWithRef } from "react";

export type FieldAttributes = Omit<ComponentPropsWithRef<"label">, "label" | "children">;

export function Field({
  label,
  className,
  style,
  ...attributes
}: { label: string } & FieldAttributes) {
  return (
    <label className={className} style={style} {...attributes}>
      {label} <input type="text" />
    </label>
  );
}
