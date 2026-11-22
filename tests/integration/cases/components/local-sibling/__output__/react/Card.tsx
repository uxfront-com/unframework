import { CardIcon } from "./CardIcon";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
      <CardIcon symbol="+" />
      <h3>{title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}
