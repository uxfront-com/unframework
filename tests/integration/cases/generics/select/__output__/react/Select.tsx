import { type ComponentPropsWithRef, useState } from "react";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels<T extends string> {
  value: T;
  onValueChange?: (value: T) => void;
}

export type SelectAttributes = Omit<
  ComponentPropsWithRef<"label">,
  "label" | "options" | "value" | "onValueChange" | "children"
>;

export default function Select<T extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
  style,
  ...attributes
}: SelectProps<T> & SelectModels<T> & SelectAttributes) {
  const [, setLocalValue] = useState({ value: value });

  return (
    <label className={className} style={style} {...attributes}>
      {label}{" "}
      <select
        value={value}
        onChange={(event) => {
          setLocalValue({ value: event.target.value as T });
          onValueChange?.(event.target.value as T);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
