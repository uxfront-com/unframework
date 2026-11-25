import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type TransitionComponentAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export default function TransitionComponent({
  className,
  style,
  ...attributes
}: TransitionComponentAttributes) {
  return (
    <p className={cx("note", className)} style={style} {...attributes}>
      Plain child
    </p>
  );
}
