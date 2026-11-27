import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface RowListSlots {
  children?: ReactNode;
}

export type RowListAttributes = Omit<ComponentPropsWithRef<"ul">, "label" | "items" | "children">;

export default function RowList({
  label,
  items,
  children,
  className,
  style,
  ...attributes
}: { label: string; items: string[] } & RowListSlots & RowListAttributes) {
  return (
    <ul className={cx("row-list", className)} aria-label={label} style={style} {...attributes}>
      {items.map((item) => (
        <li key={item}>
          {item} {children}
        </li>
      ))}
    </ul>
  );
}
