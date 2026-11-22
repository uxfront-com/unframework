import { scopeAttributes } from "./_unframework/scopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import type { CSSProperties } from "react";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export interface HintAttributes_1 {
  className?: string;
  style?: CSSProperties;
}

export default function Hint({
  text,
  attrs,
  className,
  style,
  ...attributes
}: HintProps & HintAttributes_1) {
  return (
    <small
      id={attrs.id}
      style={{ ...styleObject(attrs.style), ...style }}
      className={className}
      {...scopeAttributes(attributes)}
    >
      {text}
    </small>
  );
}
