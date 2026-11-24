import Field from "./Field";
import type { ComponentPropsWithRef } from "react";

export type FormAttributes = Omit<ComponentPropsWithRef<"form">, "children">;

export default function Form({ className, style, ...attributes }: FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style} {...attributes}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
