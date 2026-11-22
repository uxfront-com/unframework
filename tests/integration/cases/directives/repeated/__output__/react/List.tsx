import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface ListSlots {
  renderItem?: (props: { item: string }) => ReactNode;
}

export interface ListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function List({
  items,
  renderItem,
  className,
  style,
  ...attributes
}: { items: string[] } & ListSlots & ListAttributes) {
  return (
    <ol className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item) => (
        <li key={item}>{renderItem?.({ item })}</li>
      ))}
    </ol>
  );
}
