import Base from "./Base";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PrimaryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Primary({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PrimaryAttributes) {
  return (
    <Base
      text={text}
      className={cx("primary", className)}
      style={style}
      {...scopeAttributes(attributes)}
    />
  );
}
