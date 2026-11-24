import { cx } from "./_unframework/cx";
import type { ComponentPropsWithoutRef, Ref } from "react";

export type HeadingAttributes = Omit<
  ComponentPropsWithoutRef<"h1"> & ComponentPropsWithoutRef<"h2"> & ComponentPropsWithoutRef<"h3">,
  "tag" | "text" | "children"
> & { ref?: Ref<HTMLHeadingElement> };

export default function Heading({
  tag,
  text,
  className,
  style,
  ...attributes
}: { tag: "h1" | "h2" | "h3"; text: string } & HeadingAttributes) {
  const Tag = tag;

  return (
    <Tag className={cx("heading", className)} style={style} {...attributes}>
      {text}
    </Tag>
  );
}
