import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type SaveButtonAttributes = Omit<ComponentPropsWithRef<"button">, "title" | "children">;

export default function SaveButton({
  title,
  className,
  style,
  ...attributes
}: { title: string } & SaveButtonAttributes) {
  return (
    <button type="button" className={cx("button", className)} style={style} {...attributes}>
      {title}
    </button>
  );
}
