import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ItemAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Item({ className, style, ...attributes }: ItemAttributes) {
  return (
    <span className={className} style={style} {...scopeAttributes(attributes)}>
      Item
    </span>
  );
}
