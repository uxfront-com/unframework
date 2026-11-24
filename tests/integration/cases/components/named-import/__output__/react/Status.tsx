import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface StatusAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Status({
  state,
  className,
  style,
  ...attributes
}: { state: string } & StatusAttributes) {
  return (
    <p className={cx("status", className)} style={style} {...scopeAttributes(attributes)}>
      <Badge text="Build" />
      <Tag text={state} />
    </p>
  );
}
