import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface KeepAliveAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function KeepAlive({
  level,
  className,
  style,
  ...attributes
}: { level: number } & KeepAliveAttributes) {
  return (
    <div className={cx("level", className)} style={style} {...scopeAttributes(attributes)}>
      <span>Level {level}</span>
      {level > 0 ? <KeepAlive level={level - 1} /> : null}
    </div>
  );
}
