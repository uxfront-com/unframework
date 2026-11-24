import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Card({ className, style, ...attributes }: CardAttributes) {
  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      Card
    </p>
  );
}
