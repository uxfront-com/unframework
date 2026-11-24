import type { ComponentPropsWithRef, ReactNode } from "react";

export interface OptionsSlots<T extends { value: string }> {
  renderOption?: (props: { option: T }) => ReactNode;
}

export type OptionsAttributes = Omit<
  ComponentPropsWithRef<"ul">,
  "options" | "renderOption" | "children"
>;

export default function Options<T extends { value: string }>({
  options,
  renderOption,
  className,
  style,
  ...attributes
}: { options: T[] } & OptionsSlots<T> & OptionsAttributes) {
  return (
    <ul className={className} style={style} {...attributes}>
      {options.map((option) => (
        <li key={option.value}>{renderOption?.({ option })}</li>
      ))}
    </ul>
  );
}
