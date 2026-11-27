import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface OnceSlotSlots {
  renderText?: (props: { label: string }) => ReactNode;
}

export type OnceSlotAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "label" | "renderText" | "children"
>;

export default function OnceSlot({
  label,
  renderText,
  className,
  style,
  ...attributes
}: { label: string } & OnceSlotSlots & OnceSlotAttributes) {
  return (
    <span className={cx("once-slot", className)} style={style} {...attributes}>
      {renderText?.({ label })}
    </span>
  );
}
