import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Tag.uf.tsx.css";

export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "name" | "children">;

export default function Tag({
  name,
  className,
  style,
  ...attributes
}: { name: string } & TagAttributes) {
  return (
    <span className={cx("tag", className)} style={style} data-uf-ef5e671c="" {...attributes}>
      {name}
    </span>
  );
}
