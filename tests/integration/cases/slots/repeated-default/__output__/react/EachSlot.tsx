import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface EachSlotSlots {
  renderRow?: (props: { item: string }) => ReactNode;
}

export type EachSlotAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "items" | "renderRow" | "children"
>;

export default function EachSlot({
  items,
  renderRow,
  className,
  style,
  ...attributes
}: { items: string[] } & EachSlotSlots & EachSlotAttributes) {
  return (
    <span className={cx("each-slot", className)} style={style} {...attributes}>
      {items.map((item) => (
        <span key={item} className="each-row">
          {renderRow?.({ item })}
        </span>
      ))}
    </span>
  );
}
