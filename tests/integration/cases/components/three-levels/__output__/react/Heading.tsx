import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type HeadingAttributes = Omit<ComponentPropsWithRef<"h3">, "text" | "children">;

export default function Heading({
  text,
  className,
  style,
  ...attributes
}: { text: string } & HeadingAttributes) {
  return (
    <h3 className={cx("heading", className)} style={style} {...attributes}>
      {text}
    </h3>
  );
}
