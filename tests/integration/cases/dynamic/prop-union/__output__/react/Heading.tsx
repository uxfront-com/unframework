import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HeadingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Heading({
  tag,
  text,
  className,
  style,
  ...attributes
}: { tag: "h1" | "h2" | "h3"; text: string } & HeadingAttributes) {
  const Tag = tag;

  return (
    <Tag className={cx("heading", className)} style={style} {...scopeAttributes(attributes)}>
      {text}
    </Tag>
  );
}
