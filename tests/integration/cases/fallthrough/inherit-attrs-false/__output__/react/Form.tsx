import Field from "./Field";
import type { CSSProperties } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Form({ className, style }: FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
