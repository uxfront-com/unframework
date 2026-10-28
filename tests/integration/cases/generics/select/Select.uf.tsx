import { defineModel } from "unframework";

// A generic model (ADR-0068): the value is one of the consumer's options.
export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export default function Select<T extends string>({ label, options }: SelectProps<T>) {
  const value = defineModel<T>("value", { required: true });
  return (
    <label>
      {label}{" "}
      <select v-model={value.value}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
