import { CardIcon } from "./CardIcon";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type CardAttributes = Omit<ComponentPropsWithRef<"div">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...attributes}>
      <CardIcon symbol="+" />
      <h3>{title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}
