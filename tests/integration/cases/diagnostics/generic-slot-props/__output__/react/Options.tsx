import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface OptionsSlots<T extends { value: string }> {
  renderOption?: (props: { option: T }) => ReactNode;
}

export interface OptionsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Options<T extends { value: string }>({
  options,
  renderOption,
  className,
  style,
  ...attributes
}: { options: T[] } & OptionsSlots<T> & OptionsAttributes) {
  return (
    <ul className={className} style={style} {...scopeAttributes(attributes)}>
      {options.map((option) => (
        <li key={option.value}>{renderOption?.({ option })}</li>
      ))}
    </ul>
  );
}
