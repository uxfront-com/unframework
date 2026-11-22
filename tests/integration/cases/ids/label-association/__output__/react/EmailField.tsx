import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useId } from "react";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export interface EmailFieldAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <div className={cx("email-field", className)} style={style} {...scopeAttributes(attributes)}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
    </div>
  );
}
