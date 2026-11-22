import type { ComponentPropsWithRef } from "react";

export interface FieldProps {
  name: string;
  label: string;
}

export type FieldAttributes = Omit<ComponentPropsWithRef<"label">, "name" | "label" | "children">;

export default function Field({
  name,
  label,
  className,
  style,
  ...attributes
}: FieldProps & FieldAttributes) {
  return (
    <label className={className} style={style} {...attributes}>
      {label}
      <input name={name} />
    </label>
  );
}
