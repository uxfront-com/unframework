import type { ComponentPropsWithRef, ReactNode } from "react";

export interface ListSlots {
  renderItem?: (props: { item: string }) => ReactNode;
}

export type ListAttributes = Omit<ComponentPropsWithRef<"ol">, "items" | "renderItem" | "children">;

export default function List({
  items,
  renderItem,
  className,
  style,
  ...attributes
}: { items: string[] } & ListSlots & ListAttributes) {
  return (
    <ol className={className} style={style} {...attributes}>
      {items.map((item) => (
        <li key={item}>{renderItem?.({ item })}</li>
      ))}
    </ol>
  );
}
