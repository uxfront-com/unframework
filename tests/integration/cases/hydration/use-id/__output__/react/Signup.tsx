import Field from "./Field";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface SignupProps {
  name: string;
  email: string;
}

export interface SignupAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Signup({
  name,
  email,
  className,
  style,
  ...attributes
}: SignupProps & SignupAttributes) {
  return (
    <form
      className={cx("signup", className)}
      aria-label="Sign up"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Field label={name} hint="As it appears on your card." />
      <Field label={email} hint="We send the receipt here." />
    </form>
  );
}
