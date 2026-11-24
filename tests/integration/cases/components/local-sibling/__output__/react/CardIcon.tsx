import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type CardIconAttributes = Omit<ComponentPropsWithRef<"span">, "symbol" | "children">;

export function CardIcon({
  symbol,
  className,
  style,
  ...attributes
}: { symbol: string } & CardIconAttributes) {
  return (
    <span className={cx("icon", className)} aria-hidden="true" style={style} {...attributes}>
      {symbol}
    </span>
  );
}
