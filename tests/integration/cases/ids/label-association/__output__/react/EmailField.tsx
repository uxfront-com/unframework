import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useId } from "react";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export type EmailFieldAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "label" | "hint" | "children"
>;

export default function EmailField({
  label,
  hint,
  className,
  style,
  ...attributes
}: EmailFieldProps & EmailFieldAttributes) {
  const inputId = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;

  return (
    <div className={cx("email-field", className)} style={style} {...attributes}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
    </div>
  );
}
