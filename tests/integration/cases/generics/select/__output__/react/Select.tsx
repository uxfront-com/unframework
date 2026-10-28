import { type CSSProperties, useState } from "react";

export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

export interface SelectModels {
  value: T;
  onValueChange?: (value: T) => void;
}

export interface SelectAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Select({
  label,
  options,
  value,
  onValueChange,
  className,
  style,
  ...attributes
}: SelectProps<T> & SelectModels & SelectAttributes) {
  const [, setLocalValue] = useState({ value: value });

  return (
    <label className={className} style={style} {...scopeAttributes(attributes)}>
      {label}{" "}
      <select
        value={value}
        onChange={(event) => {
          setLocalValue({ value: event.target.value });
          onValueChange?.(event.target.value);
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
