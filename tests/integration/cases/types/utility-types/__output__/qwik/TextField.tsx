import type { FieldOptions } from "./types";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

export default component$<
  TextFieldProps &
    Omit<PropsOf<"label">, "name" | "label" | "placeholder" | "required" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, label, placeholder, required, class: className, style, ...attributes }) => {
  return (
    <label class={className} style={style} {...attributes}>
      {label}
      <input name={name} placeholder={placeholder} required={required} />
    </label>
  );
});
