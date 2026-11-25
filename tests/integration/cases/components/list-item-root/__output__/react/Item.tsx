import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type ItemAttributes = Omit<ComponentPropsWithRef<"li">, "label" | "children">;

export default function Item({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ItemAttributes) {
  return (
    <li className={cx("item", className)} style={style} {...attributes}>
      {label}
    </li>
  );
}
