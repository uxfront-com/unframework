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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
