import type { FieldOptions } from "./types";

// The five utility types of plan §5.5, over an imported interface.
export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

export default function TextField({ name, label, placeholder, required }: TextFieldProps) {
  return (
    <label>
      {label}
      <input name={name} placeholder={placeholder} required={required} />
    </label>
  );
}
