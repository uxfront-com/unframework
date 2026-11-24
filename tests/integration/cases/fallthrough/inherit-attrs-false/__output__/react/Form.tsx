import Field from "./Field";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Form({ className, style, ...attributes }: FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style} {...scopeAttributes(attributes)}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
