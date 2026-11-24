import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface RowAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Row({
  name,
  done,
  className,
  style,
  ...attributes
}: { name: string; done: boolean } & RowAttributes) {
  return (
    <div
      role="listitem"
      className={cx("row", { done }, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {name}
      {done ? " (done)" : ""}
    </div>
  );
}
