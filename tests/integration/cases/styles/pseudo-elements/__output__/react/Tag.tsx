import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Tag.uf.tsx.css";

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({
  name,
  className,
  style,
  ...attributes
}: { name: string } & TagAttributes) {
  return (
    <span
      className={cx("tag", className)}
      style={style}
      data-uf-ef5e671c=""
      {...scopeAttributes(attributes)}
    >
      {name}
    </span>
  );
}
