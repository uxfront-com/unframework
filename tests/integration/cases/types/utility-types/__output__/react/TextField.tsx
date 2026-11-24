import type { FieldOptions } from "./types";
import type { ComponentPropsWithRef } from "react";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

export type TextFieldAttributes = Omit<
  ComponentPropsWithRef<"label">,
  "name" | "label" | "placeholder" | "required" | "children"
>;

export default function TextField({
  name,
  label,
  placeholder,
  required,
  className,
  style,
  ...attributes
}: TextFieldProps & TextFieldAttributes) {
  return (
    <label className={className} style={style} {...attributes}>
      {label}
      <input name={name} placeholder={placeholder} required={required} />
    </label>
  );
}
