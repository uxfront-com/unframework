import type { ComponentPropsWithRef, ReactNode } from "react";

export interface ListSlots {
  renderItem?: (props: { item: string; index: number }) => ReactNode;
}

export type ListAttributes = Omit<
  ComponentPropsWithRef<"ul">,
  "items" | "label" | "renderItem" | "children"
>;

export default function List({
  items,
  label,
  renderItem,
  className,
  style,
  ...attributes
}: { items: string[]; label: string } & ListSlots & ListAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...attributes}>
      {items.map((item, index) => (
        <li key={item}>{renderItem?.({ item, index })}</li>
      ))}
    </ul>
  );
}
