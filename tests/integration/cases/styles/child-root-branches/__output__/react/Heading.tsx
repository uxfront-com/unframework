import { cx } from "./_unframework/cx";
import type { ComponentPropsWithoutRef, Ref } from "react";

export type HeadingAttributes = Omit<
  ComponentPropsWithoutRef<"h2"> & ComponentPropsWithoutRef<"h3">,
  "big" | "text" | "children"
> & { ref?: Ref<HTMLHeadingElement> };

export default function Heading({
  big,
  text,
  className,
  style,
  ...attributes
}: { big: boolean; text: string } & HeadingAttributes) {
  const Tag = big ? "h2" : "h3";

  return (
    <Tag className={cx("heading", className)} style={style} {...attributes}>
      {text}
    </Tag>
  );
}
