import Level from "./Level";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface OutlineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Outline({ className, style, ...attributes }: OutlineAttributes) {
  return (
    <Level title="Book" className={className} style={style} {...scopeAttributes(attributes)}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}
