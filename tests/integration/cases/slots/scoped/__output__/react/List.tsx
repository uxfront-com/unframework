import type { CSSProperties, ReactNode } from "react";

export interface ListSlots {
  renderItem?: (props: { item: string; index: number }) => ReactNode;
}

export interface ListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function List({
  items,
  label,
  renderItem,
  className,
  style,
}: { items: string[]; label: string } & ListSlots & ListAttributes) {
  return (
    <ul aria-label={label} className={className} style={style}>
      {items.map((item, index) => (
        <li key={item}>{renderItem?.({ item, index })}</li>
      ))}
    </ul>
  );
}
