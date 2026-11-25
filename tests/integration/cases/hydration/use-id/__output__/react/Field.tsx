import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useId } from "react";

export interface FieldProps {
  label: string;
  hint: string;
}

export type FieldAttributes = Omit<ComponentPropsWithRef<"p">, "label" | "hint" | "children">;

export default function Field({
  label,
  hint,
  className,
  style,
  ...attributes
}: FieldProps & FieldAttributes) {
  const inputId = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;

  return (
    <p className={cx("field", className)} style={style} {...attributes}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} type="text" aria-describedby={hintId} />
      <small id={hintId}>{hint}</small>
    </p>
  );
}
