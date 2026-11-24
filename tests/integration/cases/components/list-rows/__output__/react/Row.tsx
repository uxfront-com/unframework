import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type RowAttributes = Omit<ComponentPropsWithRef<"div">, "name" | "done" | "children">;

export default function Row({
  name,
  done,
  className,
  style,
  ...attributes
}: { name: string; done: boolean } & RowAttributes) {
  return (
    <div role="listitem" className={cx("row", { done }, className)} style={style} {...attributes}>
      {name}
      {done ? " (done)" : ""}
    </div>
  );
}
