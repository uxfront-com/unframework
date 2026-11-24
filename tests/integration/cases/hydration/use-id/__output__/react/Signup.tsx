import Field from "./Field";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface SignupProps {
  name: string;
  email: string;
}

export type SignupAttributes = Omit<ComponentPropsWithRef<"form">, "name" | "email" | "children">;

export default function Signup({
  name,
  email,
  className,
  style,
  ...attributes
}: SignupProps & SignupAttributes) {
  return (
    <form className={cx("signup", className)} aria-label="Sign up" style={style} {...attributes}>
      <Field label={name} hint="As it appears on your card." />
      <Field label={email} hint="We send the receipt here." />
    </form>
  );
}
