import type { ComponentPropsWithRef, ReactNode } from "react";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots<T> {
  renderItem?: (props: { item: T }) => ReactNode;
}

export type PickerAttributes = Omit<
  ComponentPropsWithRef<"ul">,
  "items" | "renderItem" | "children"
>;

export default function Picker<T>({
  items,
  renderItem,
  className,
  style,
  ...attributes
}: PickerProps<T> & PickerSlots<T> & PickerAttributes) {
  return (
    <ul className={className} style={style} {...attributes}>
      {items.map((item, index) => (
        <li key={index}>{renderItem?.({ item })}</li>
      ))}
    </ul>
  );
}
