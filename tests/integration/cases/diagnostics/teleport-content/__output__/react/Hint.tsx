import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HintAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Hint({ className, style, ...attributes }: HintAttributes) {
  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      Hint
    </p>
  );
}
