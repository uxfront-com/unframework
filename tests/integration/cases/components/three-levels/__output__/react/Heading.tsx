import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HeadingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Heading({
  text,
  className,
  style,
  ...attributes
}: { text: string } & HeadingAttributes) {
  return (
    <h3 className={cx("heading", className)} style={style} {...scopeAttributes(attributes)}>
      {text}
    </h3>
  );
}
