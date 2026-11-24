import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CardIconAttributes {
  className?: string;
  style?: CSSProperties;
}

export function CardIcon({
  symbol,
  className,
  style,
  ...attributes
}: { symbol: string } & CardIconAttributes) {
  return (
    <span
      className={cx("icon", className)}
      aria-hidden="true"
      style={style}
      {...scopeAttributes(attributes)}
    >
      {symbol}
    </span>
  );
}
