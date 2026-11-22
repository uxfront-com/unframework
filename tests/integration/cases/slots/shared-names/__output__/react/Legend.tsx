import type { ComponentPropsWithRef, ReactNode } from "react";

export interface LegendSlots {
  renderSwatch?: (props: { item: string }) => ReactNode;
  renderCaption?: (props: { item: string }) => ReactNode;
}

export type LegendAttributes = Omit<
  ComponentPropsWithRef<"ul">,
  "items" | "label" | "renderSwatch" | "renderCaption" | "children"
>;

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
    <ul aria-label={label} className={className} style={style} {...attributes}>
      {items.map((item) => (
        <li key={item}>
          <span>{renderSwatch?.({ item })}</span> <span>{renderCaption?.({ item })}</span>
        </li>
      ))}
    </ul>
  );
}
