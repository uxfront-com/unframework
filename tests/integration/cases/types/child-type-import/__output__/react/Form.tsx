import Field, { type FieldProps } from "./Field";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Form({
  field,
  className,
  style,
  ...attributes
}: { field: FieldProps } & FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style} {...scopeAttributes(attributes)}>
      <Field name={field.name} label={field.label} />
    </form>
  );
}
