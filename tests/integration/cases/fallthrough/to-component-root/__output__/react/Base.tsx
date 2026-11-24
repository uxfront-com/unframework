import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type BaseAttributes = Omit<ComponentPropsWithRef<"button">, "text" | "children">;

export default function Base({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BaseAttributes) {
  return (
    <button type="button" className={cx("base", className)} style={style} {...attributes}>
      {text}
    </button>
  );
}
