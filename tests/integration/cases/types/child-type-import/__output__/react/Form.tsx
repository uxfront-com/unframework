import Field, { type FieldProps } from "./Field";
import type { ComponentPropsWithRef } from "react";

export type FormAttributes = Omit<ComponentPropsWithRef<"form">, "field" | "children">;

export default function Form({
  field,
  className,
  style,
  ...attributes
}: { field: FieldProps } & FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style} {...attributes}>
      <Field name={field.name} label={field.label} />
    </form>
  );
}
