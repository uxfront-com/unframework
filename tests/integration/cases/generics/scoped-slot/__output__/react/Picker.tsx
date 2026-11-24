import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots<T> {
  renderItem?: (props: { item: T }) => ReactNode;
}

export interface PickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Picker<T>({
  items,
  renderItem,
  className,
  style,
  ...attributes
}: PickerProps<T> & PickerSlots<T> & PickerAttributes) {
  return (
    <ul className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item, index) => (
        <li key={index}>{renderItem?.({ item })}</li>
      ))}
    </ul>
  );
}
