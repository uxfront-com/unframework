import type { ComponentPropsWithRef } from "react";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export type ListAttributes = Omit<
  ComponentPropsWithRef<"ul">,
  "label" | "items" | "selected" | "children"
>;

export default function List<T>({
  label,
  items,
  selected,
  className,
  style,
  ...attributes
}: ListProps<T> & ListAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...attributes}>
      {items.map((item, index) => (
        <li key={index} aria-current={item === selected ? "true" : undefined}>
          {String(item)}
        </li>
      ))}
    </ul>
  );
}
