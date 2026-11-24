import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HeadingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Heading({
  big,
  text,
  className,
  style,
  ...attributes
}: { big: boolean; text: string } & HeadingAttributes) {
  const Tag = big ? "h2" : "h3";

  return (
    <Tag className={cx("heading", className)} style={style} {...scopeAttributes(attributes)}>
      {text}
    </Tag>
  );
}
