import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export interface ListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function List<T>({
  label,
  items,
  selected,
  className,
  style,
  ...attributes
}: ListProps<T> & ListAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item, index) => (
        <li key={index} aria-current={item === selected ? "true" : undefined}>
          {String(item)}
        </li>
      ))}
    </ul>
  );
}
