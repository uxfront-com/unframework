import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface LegendSlots {
  renderSwatch?: (props: { item: string }) => ReactNode;
  renderCaption?: (props: { item: string }) => ReactNode;
}

export interface LegendAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Legend({
  items,
  label,
  renderSwatch,
  renderCaption,
  className,
  style,
  ...attributes
}: { items: string[]; label: string } & LegendSlots & LegendAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item) => (
        <li key={item}>
          <span>{renderSwatch?.({ item })}</span> <span>{renderCaption?.({ item })}</span>
        </li>
      ))}
    </ul>
  );
}
