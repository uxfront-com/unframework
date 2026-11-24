import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CountdownAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Countdown({
  from,
  className,
  style,
  ...attributes
}: { from: number } & CountdownAttributes) {
  return (
    <div className={cx("level", className)} style={style} {...scopeAttributes(attributes)}>
      <span>{from}</span>
      {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
    </div>
  );
}
