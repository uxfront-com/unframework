import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type CardAttributes = Omit<ComponentPropsWithRef<"div">, "label" | "children">;

export default function Card({
  label,
  className,
  style,
  ...attributes
}: { label: string } & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...attributes}>
      <strong>{label}</strong>
    </div>
  );
}
